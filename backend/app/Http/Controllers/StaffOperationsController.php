<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractPayment;
use App\Models\InspectionPhoto;
use App\Models\Room;
use App\Models\RoomInspection;
use App\Services\RentLedger;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StaffOperationsController extends Controller
{
    private const AREAS = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];

    public function dashboard(RentLedger $ledger): JsonResponse
    {
        $rooms = Room::with('building:id,name')->orderBy('building_id')->orderBy('floor')->orderBy('code')->get();
        $contracts = Contract::with('tenant:id,full_name', 'room.building:id,name', 'payments')->where('status', 'active')->get();
        $due = [];
        foreach ($contracts as $contract) {
            $summary = $ledger->forContract($contract);
            foreach ($summary['installments'] as $installment) {
                if ($installment['balance'] !== '0.00' && $installment['due_on'] <= now()->addDays(30)->toDateString()) {
                    $due[] = ['contract_id' => $contract->id, 'tenant' => $contract->tenant->full_name,
                        'room' => $contract->room->building->name.' · Room '.$contract->room->code] + $installment;
                }
            }
        }
        usort($due, fn ($a, $b) => strcmp($a['due_on'], $b['due_on']));

        return response()->json([
            'room_count' => $rooms->count(),
            'statuses' => $rooms->countBy('status'),
            'active_tenancies' => $contracts->count(),
            'rent_due' => collect($due)->filter(fn ($item) => $item['is_due'])->sum(fn ($item) => (int) round((float) $item['balance'] * 100)) / 100,
            'upcoming' => array_slice($due, 0, 12),
        ]);
    }

    public function ledgers(RentLedger $ledger): JsonResponse
    {
        return response()->json(Contract::with('payments')->orderByDesc('id')->get()->mapWithKeys(fn ($contract) => [$contract->id => $ledger->forContract($contract)]));
    }

    public function storePayment(Request $request, Contract $contract, RentLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'submission_key' => ['required', 'uuid'],
            'kind' => ['required', Rule::in(['rent', 'advance', 'deposit'])],
            'period_month' => ['required_if:kind,rent', 'nullable', 'date_format:Y-m'],
            'paid_on' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'method' => ['required', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $payment = DB::transaction(function () use ($request, $contract, $data, $ledger) {
            $contract = Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $existing = ContractPayment::where('submission_key', $data['submission_key'])->first();
            if ($existing) {
                if ($existing->contract_id !== $contract->id || $existing->kind !== $data['kind'] || $existing->amount !== number_format((float) $data['amount'], 2, '.', '')) {
                    throw ValidationException::withMessages(['submission_key' => 'This submission key belongs to another payment.']);
                }

                return $existing;
            }
            if ($contract->status === 'draft') {
                throw ValidationException::withMessages(['contract_id' => 'Record signing before adding ledger payments.']);
            }
            if ($contract->status === 'signed' && $data['kind'] !== 'rent') {
                throw ValidationException::withMessages(['kind' => 'Signing has already recorded the advance and deposit. Renewal balances transfer at move-in.']);
            }
            $period = null;
            if ($data['kind'] === 'rent') {
                $period = CarbonImmutable::createFromFormat('!Y-m', $data['period_month'])->startOfMonth();
                $summary = $ledger->forContract($contract->load('payments'));
                $installment = collect($summary['installments'])->firstWhere('period_month', $period->format('Y-m'));
                if (! $installment) {
                    throw ValidationException::withMessages(['period_month' => 'Choose a month within this contract term.']);
                }
                if (round((float) $data['amount'] * 100) > round((float) $installment['balance'] * 100)) {
                    throw ValidationException::withMessages(['amount' => 'Payment exceeds this month’s remaining rent.']);
                }
            } else {
                if (! empty($data['period_month'])) {
                    throw ValidationException::withMessages(['period_month' => 'Advance and deposit are not assigned to a rent month.']);
                }
                $limit = $data['kind'] === 'advance' ? $contract->advance_amount : $contract->deposit_amount;
                $already = $contract->payments()->where('kind', $data['kind'])->sum('amount');
                if (round(((float) $already + (float) $data['amount']) * 100) > round((float) $limit * 100)) {
                    throw ValidationException::withMessages(['amount' => 'Payment exceeds the agreed '.$data['kind'].' amount.']);
                }
            }

            return $contract->payments()->create([
                'recorded_by' => $request->user()->id, 'kind' => $data['kind'],
                'period_month' => $period?->toDateString(), 'paid_on' => $data['paid_on'],
                'amount' => $data['amount'], 'method' => $data['method'],
                'reference' => $data['reference'] ?? null, 'notes' => $data['notes'] ?? null,
                'submission_key' => $data['submission_key'],
            ]);
        });

        return response()->json($payment->load('recorder'), $payment->wasRecentlyCreated ? 201 : 200);
    }

    public function inspections(Room $room): JsonResponse
    {
        return response()->json(RoomInspection::with('items', 'photos', 'inspector')->where('room_id', $room->id)->orderByDesc('inspected_on')->orderByDesc('id')->get());
    }

    public function storeInspection(Request $request, Room $room): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['move_in', 'routine', 'move_out'])],
            'contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
            'inspected_on' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'items' => ['required', 'array', 'size:8'],
            'items.*.area' => ['required', Rule::in(self::AREAS)],
            'items.*.condition' => ['required', Rule::in(['good', 'needs_repair', 'not_checked'])],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);
        if (count(array_unique(array_column($data['items'], 'area'))) !== count(self::AREAS)) {
            throw ValidationException::withMessages(['items' => 'Record every checklist area once.']);
        }
        if (isset($data['contract_id']) && ! Contract::whereKey($data['contract_id'])->where('room_id', $room->id)->exists()) {
            throw ValidationException::withMessages(['contract_id' => 'Contract must belong to this room.']);
        }
        $inspection = DB::transaction(function () use ($request, $room, $data) {
            $inspection = RoomInspection::create([
                'room_id' => $room->id, 'contract_id' => $data['contract_id'] ?? null,
                'inspected_by' => $request->user()->id, 'type' => $data['type'],
                'inspected_on' => $data['inspected_on'], 'notes' => $data['notes'] ?? null,
            ]);
            $inspection->items()->createMany($data['items']);

            return $inspection;
        });

        return response()->json($inspection->load('items', 'photos', 'inspector'), 201);
    }

    public function uploadInspectionPhoto(Request $request, RoomInspection $inspection): JsonResponse
    {
        $request->validate(['photo' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120']]);
        $file = $request->file('photo');
        $path = $file->store('inspections/'.$inspection->id, 'local');
        $photo = $inspection->photos()->create(['path' => $path, 'original_name' => $file->getClientOriginalName(), 'uploaded_by' => $request->user()->id]);

        return response()->json($photo, 201);
    }

    public function inspectionPhoto(RoomInspection $inspection, InspectionPhoto $photo)
    {
        abort_unless($photo->room_inspection_id === $inspection->id && Storage::disk('local')->exists($photo->path), 404);

        return Storage::disk('local')->response($photo->path, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
