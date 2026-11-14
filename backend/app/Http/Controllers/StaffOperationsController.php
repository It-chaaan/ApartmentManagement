<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractAdjustment;
use App\Models\ContractPayment;
use App\Models\InspectionPhoto;
use App\Models\Room;
use App\Models\RoomInspection;
use App\Models\UtilityBillPayment;
use App\Models\UtilityBillRefund;
use App\Services\RentLedger;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffOperationsController extends Controller
{
    private const AREAS = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];

    public function dashboard(Request $request, RentLedger $ledger): JsonResponse
    {
        $filters = $request->validate(['building_id' => ['sometimes', 'integer', 'exists:buildings,id']]);
        $buildingId = $filters['building_id'] ?? null;
        $rooms = Room::with('building:id,name')->when($buildingId, fn ($query) => $query->where('building_id', $buildingId))
            ->orderBy('building_id')->orderBy('floor')->orderBy('code')->get();
        $contracts = Contract::with('tenant:id,full_name', 'room.building:id,name', 'payments')
            ->whereIn('status', ['signed', 'active'])
            ->when($buildingId, fn ($query) => $query->whereHas('room', fn ($roomQuery) => $roomQuery->where('building_id', $buildingId)))->get();
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
        $today = today()->toDateString();
        $cutoff = today()->addDays(30)->toDateString();
        $expiring = $contracts->where('status', 'active')->filter(fn (Contract $contract) => $contract->ends_on->format('Y-m-d') >= $today && $contract->ends_on->format('Y-m-d') <= $cutoff)
            ->sortBy('ends_on')->map(fn (Contract $contract) => [
                'contract_id' => $contract->id, 'tenant' => $contract->tenant->full_name,
                'room' => $contract->room->building->name.' · Room '.$contract->room->code,
                'ends_on' => $contract->ends_on->format('Y-m-d'),
            ])->values();
        $latestInspections = RoomInspection::with('items', 'room.building:id,name')
            ->whereIn('room_id', $rooms->pluck('id'))->orderByDesc('inspected_on')->orderByDesc('id')->get()->unique('room_id');
        $repairs = $latestInspections->filter(fn (RoomInspection $inspection) => $inspection->items->contains('condition', 'needs_repair'))
            ->map(fn (RoomInspection $inspection) => [
                'room_id' => $inspection->room_id,
                'room' => $inspection->room->building->name.' · Room '.$inspection->room->code,
                'inspected_on' => $inspection->inspected_on->format('Y-m-d'),
                'areas' => $inspection->items->where('condition', 'needs_repair')->pluck('area')->values(),
            ])->values();

        return response()->json([
            'room_count' => $rooms->count(),
            'statuses' => $rooms->countBy('status'),
            'active_tenancies' => $contracts->where('status', 'active')->count(),
            'rent_due' => collect($due)->filter(fn ($item) => $item['is_due'])->sum(fn ($item) => (int) round((float) $item['balance'] * 100)) / 100,
            'upcoming' => array_slice($due, 0, 12),
            'expiring_contracts' => $expiring,
            'repair_checklists' => $repairs,
            'unverified_rooms' => $rooms->where('status', 'unverified')->map(fn (Room $room) => [
                'room_id' => $room->id, 'room' => $room->building->name.' · Room '.$room->code,
            ])->values(),
        ]);
    }

    public function ledgers(RentLedger $ledger): JsonResponse
    {
        return response()->json(Contract::with('payments.voider')->orderByDesc('id')->get()->mapWithKeys(fn ($contract) => [$contract->id => $ledger->forContract($contract)]));
    }

    public function exportPayments(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'building_id' => ['sometimes', 'integer', 'exists:buildings,id'],
        ]);
        if (CarbonImmutable::parse($filters['from'])->diffInDays(CarbonImmutable::parse($filters['to'])) > 366) {
            throw ValidationException::withMessages(['to' => 'Choose a date range of at most one year.']);
        }
        $buildingId = $filters['building_id'] ?? null;
        $rent = ContractPayment::with('contract.tenant', 'contract.room.building', 'recorder', 'voider')
            ->whereBetween('paid_on', [$filters['from'], $filters['to']])
            ->when($buildingId, fn ($query) => $query->whereHas('contract.room', fn ($roomQuery) => $roomQuery->where('building_id', $buildingId)))->get();
        $utilities = UtilityBillPayment::with('bill.room.building', 'recorder', 'voider')
            ->whereBetween('paid_on', [$filters['from'], $filters['to']])
            ->when($buildingId, fn ($query) => $query->whereHas('bill.room', fn ($roomQuery) => $roomQuery->where('building_id', $buildingId)))->get();
        $contractAdjustments = ContractAdjustment::with('contract.tenant', 'contract.room.building', 'approver', 'voider')
            ->whereBetween('occurred_on', [$filters['from'], $filters['to']])
            ->when($buildingId, fn ($query) => $query->whereHas('contract.room', fn ($roomQuery) => $roomQuery->where('building_id', $buildingId)))->get();
        $utilityRefunds = UtilityBillRefund::with('bill.room.building', 'approver', 'voider')
            ->whereBetween('refunded_on', [$filters['from'], $filters['to']])
            ->when($buildingId, fn ($query) => $query->whereHas('bill.room', fn ($roomQuery) => $roomQuery->where('building_id', $buildingId)))->get();
        $rows = collect();
        foreach ($rent as $payment) {
            $rows->push([
                $payment->paid_on->format('Y-m-d'), 'Rent: '.$payment->kind,
                $payment->contract->room->building->name, $payment->contract->room->code,
                $payment->contract->tenant->full_name, '#'.$payment->contract_id,
                $payment->period_month?->format('Y-m') ?? '', $payment->amount,
                $payment->method, $payment->reference ?? '', $payment->voided_at ? 'Voided' : 'Recorded',
                $payment->void_reason ?? '', $payment->recorder?->name ?? 'Legacy record', $payment->voider?->name ?? '',
            ]);
        }
        foreach ($utilities as $payment) {
            $rows->push([
                $payment->paid_on->format('Y-m-d'), 'Utility: '.$payment->bill->kind,
                $payment->bill->room->building->name, $payment->bill->room->code,
                '', 'Bill #'.$payment->utility_bill_id,
                $payment->bill->period_month->format('Y-m'), $payment->amount,
                $payment->method, $payment->reference ?? '', $payment->voided_at ? 'Voided' : 'Recorded',
                $payment->void_reason ?? '', $payment->recorder->name, $payment->voider?->name ?? '',
            ]);
        }
        foreach ($contractAdjustments as $adjustment) {
            $rows->push([
                $adjustment->occurred_on->format('Y-m-d'), 'Settlement: '.$adjustment->kind,
                $adjustment->contract->room->building->name, $adjustment->contract->room->code,
                $adjustment->contract->tenant->full_name, '#'.$adjustment->contract_id,
                '', $adjustment->amount, $adjustment->method ?? '', $adjustment->reference ?? '',
                $adjustment->voided_at ? 'Voided' : 'Approved', $adjustment->reason,
                $adjustment->approver->name, $adjustment->voider?->name ?? '',
            ]);
        }
        foreach ($utilityRefunds as $refund) {
            $rows->push([
                $refund->refunded_on->format('Y-m-d'), 'Utility refund',
                $refund->bill->room->building->name, $refund->bill->room->code,
                '', 'Bill #'.$refund->utility_bill_id,
                $refund->bill->period_month->format('Y-m'), $refund->amount,
                $refund->method, $refund->reference ?? '', $refund->voided_at ? 'Voided' : 'Approved',
                $refund->reason, $refund->approver->name, $refund->voider?->name ?? '',
            ]);
        }

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['Paid on', 'Type', 'Building', 'Room', 'Tenant', 'Record', 'Period', 'Amount PHP', 'Method', 'Reference', 'Status', 'Correction reason', 'Recorded by', 'Voided by'], ',', '"', '');
            foreach ($rows->sortBy(fn ($row) => $row[0].$row[5]) as $row) {
                fputcsv($output, array_map(fn ($value) => preg_match('/^\s*[=+\-@]/u', (string) $value) ? "'".$value : (string) $value, $row), ',', '"', '');
            }
            fclose($output);
        }, 'payments-'.$filters['from'].'-to-'.$filters['to'].'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
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
                if ($existing->voided_at || $existing->contract_id !== $contract->id || $existing->kind !== $data['kind'] || $existing->amount !== number_format((float) $data['amount'], 2, '.', '')
                    || $existing->period_month?->format('Y-m') !== ($data['period_month'] ?? null) || $existing->paid_on->format('Y-m-d') !== $data['paid_on']
                    || $existing->method !== $data['method'] || $existing->reference !== ($data['reference'] ?? null) || $existing->notes !== ($data['notes'] ?? null)) {
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
            } else {
                if (! empty($data['period_month'])) {
                    throw ValidationException::withMessages(['period_month' => 'Advance and deposit are not assigned to a rent month.']);
                }
                $limit = $data['kind'] === 'advance' ? $contract->advance_amount : $contract->deposit_amount;
                $already = $contract->payments()->whereNull('voided_at')->where('kind', $data['kind'])->sum('amount');
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

    public function voidPayment(Request $request, Contract $contract, ContractPayment $payment, RentLedger $ledger): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        DB::transaction(function () use ($request, $contract, $payment, $data, $ledger): void {
            $contract = Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $payment = ContractPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $firstMonth = $contract->starts_on->format('Y-m');
            if ($payment->contract_id !== $contract->id || $payment->voided_at || $payment->kind !== 'rent'
                || $payment->period_month?->format('Y-m') === $firstMonth || $payment->method === 'carryover') {
                throw ValidationException::withMessages(['payment' => 'Only a later, active rent payment can be corrected. Signing and carryover entries must remain intact.']);
            }
            $summary = $ledger->forContract($contract->load('payments', 'adjustments'));
            $month = collect($summary['installments'])->firstWhere('period_month', $payment->period_month->format('Y-m'));
            $paidCents = (int) round((float) ($month['paid'] ?? 0) * 100);
            $rentCents = (int) round((float) ($month['amount'] ?? 0) * 100);
            $paymentCents = (int) round((float) $payment->amount * 100);
            $creditLost = max(0, $paidCents - $rentCents) - max(0, $paidCents - $paymentCents - $rentCents);
            if ($creditLost > (int) round((float) $summary['rent_credit'] * 100)) {
                throw ValidationException::withMessages(['payment' => 'A refund already uses this overpayment. Void the refund first.']);
            }
            $payment->update(['voided_at' => now(), 'voided_by' => $request->user()->id, 'void_reason' => $data['reason']]);
        });

        return response()->json(['message' => 'Payment voided. Record a replacement if needed.']);
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
