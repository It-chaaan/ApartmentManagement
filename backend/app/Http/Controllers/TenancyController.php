<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractFile;
use App\Models\Room;
use App\Models\Tenant;
use App\Services\RentLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenancyController extends Controller
{
    public function tenants(): JsonResponse
    {
        return response()->json(Tenant::with(['contracts' => fn ($q) => $q->with('room.building', 'files')->orderByDesc('starts_on')])->orderBy('full_name')->get());
    }

    public function storeTenant(Request $request): JsonResponse
    {
        return response()->json(Tenant::create($this->tenantData($request)), 201);
    }

    public function updateTenant(Request $request, Tenant $tenant): JsonResponse
    {
        $tenant->update($this->tenantData($request));

        return response()->json($tenant->fresh()->load('contracts.room.building'));
    }

    private function tenantData(Request $request): array
    {
        return $request->validate([
            'full_name' => ['required', 'string', 'max:200'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:255'],
            'contact_address' => ['nullable', 'string', 'max:1000'],
            'emergency_name' => ['nullable', 'string', 'max:200'],
            'emergency_phone' => ['nullable', 'string', 'max:40'],
            'emergency_relationship' => ['nullable', 'string', 'max:100'],
        ]);
    }

    public function contracts(): JsonResponse
    {
        return response()->json(Contract::with('tenant', 'room.building', 'files', 'previousContract')->orderByDesc('id')->get());
    }

    public function storeContract(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'previous_contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
            'signed_on' => ['required', 'date_format:Y-m-d'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after:starts_on'],
            'monthly_rent' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'due_day' => ['required', 'integer', 'between:1,31'],
            'advance_amount' => ['required', 'numeric', 'gte:0', 'max:99999999.99'],
            'deposit_amount' => ['required', 'numeric', 'gte:0', 'max:99999999.99'],
        ]);
        if ((int) round((float) $data['advance_amount'] * 100) !== (int) round((float) $data['monthly_rent'] * 100) || (int) round((float) $data['deposit_amount'] * 100) !== (int) round((float) $data['monthly_rent'] * 100)) {
            throw ValidationException::withMessages(['advance_amount' => 'The advance and deposit must each equal one month of rent.']);
        }
        if (isset($data['previous_contract_id'])) {
            $previous = Contract::findOrFail($data['previous_contract_id']);
            if ($previous->tenant_id !== (int) $data['tenant_id'] || $previous->room_id !== (int) $data['room_id'] || $previous->status === 'draft') {
                throw ValidationException::withMessages(['previous_contract_id' => 'A renewal must follow a signed contract for the same tenant and room.']);
            }
            if (substr($data['starts_on'], 0, 7) < $previous->ends_on->format('Y-m')) {
                throw ValidationException::withMessages(['starts_on' => 'The renewal must start in or after the prior contract’s final month.']);
            }
            if (Contract::where('previous_contract_id', $previous->id)->exists()) {
                throw ValidationException::withMessages(['previous_contract_id' => 'This contract already has a renewal record.']);
            }
        }
        $contract = Contract::create($data + ['status' => 'draft']);

        return response()->json($contract->load('tenant', 'room.building', 'files', 'previousContract'), 201);
    }

    public function moveIn(Request $request, Contract $contract, RentLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'moved_in_on' => ['required', 'date_format:Y-m-d'],
        ]);
        DB::transaction(function () use ($contract, $data, $request, $ledger): void {
            $room = Room::whereKey($contract->room_id)->lockForUpdate()->firstOrFail();
            $contract = Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            if ($contract->status !== 'signed') {
                throw ValidationException::withMessages(['status' => 'Record signing and the required payments before move-in.']);
            }
            if ($data['moved_in_on'] < $contract->signed_on->format('Y-m-d')) {
                throw ValidationException::withMessages(['moved_in_on' => 'Move-in cannot precede signing.']);
            }
            $firstMonth = $contract->starts_on->startOfMonth()->toDateString();
            $paidRent = $contract->payments()->where('kind', 'rent')->whereDate('period_month', $firstMonth)->sum('amount');
            if ((int) round((float) $paidRent * 100) < (int) round((float) $contract->monthly_rent * 100)) {
                throw ValidationException::withMessages(['payments' => 'First-month rent must be paid at signing.']);
            }

            $active = Contract::where('active_room_id', $room->id)->lockForUpdate()->first();
            if ($active) {
                if ($contract->previous_contract_id !== $active->id || $contract->tenant_id !== $active->tenant_id || $active->status !== 'active') {
                    throw ValidationException::withMessages(['room_id' => 'This room already has an active tenancy.']);
                }
                $previousLedger = $ledger->forContract($active->load('payments'));
                foreach (['advance' => 'advance_remaining', 'deposit' => 'deposit_paid'] as $kind => $field) {
                    $amount = $previousLedger[$field];
                    if ((float) $amount <= 0) {
                        continue;
                    }
                    $transfer = [
                        'recorded_by' => $request->user()->id,
                        'period_month' => null,
                        'paid_on' => $data['moved_in_on'],
                        'amount' => $amount,
                        'method' => 'carryover',
                        'reference' => 'Contract #'.$active->id.' → #'.$contract->id,
                        'submission_key' => (string) Str::uuid(),
                    ];
                    $active->payments()->create($transfer + ['kind' => $kind.'_transfer_out']);
                    $contract->payments()->create([...$transfer, 'kind' => $kind, 'submission_key' => (string) Str::uuid()]);
                }
                $active->update(['status' => 'renewed', 'active_room_id' => null, 'ended_on' => $data['moved_in_on'], 'end_review_note' => 'Superseded by renewal contract #'.$contract->id]);
            } elseif ($contract->previous_contract_id) {
                throw ValidationException::withMessages(['previous_contract_id' => 'The earlier tenancy is no longer active. Review the room before moving in.']);
            } elseif (! in_array($room->status, ['available', 'reserved'], true)) {
                throw ValidationException::withMessages(['room_id' => 'Confirm the room as available or reserved before starting a tenancy.']);
            }
            foreach (['advance' => 'advance_amount', 'deposit' => 'deposit_amount'] as $kind => $field) {
                $paid = $contract->payments()->where('kind', $kind)->sum('amount');
                if ((int) round((float) $paid * 100) !== (int) round((float) $contract->$field * 100)) {
                    throw ValidationException::withMessages(['payments' => 'The full advance and deposit must be accounted for before move-in.']);
                }
            }
            $contract->update(['moved_in_on' => $data['moved_in_on'], 'advance_paid' => $contract->advance_amount, 'deposit_paid' => $contract->deposit_amount, 'status' => 'active', 'active_room_id' => $room->id]);
            $room->update(['status' => 'occupied']);
        });

        return response()->json($contract->fresh()->load('tenant', 'room.building', 'files', 'previousContract'));
    }

    public function end(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate(['ended_on' => ['required', 'date_format:Y-m-d'], 'end_review_note' => ['required', 'string', 'min:3', 'max:2000']]);
        DB::transaction(function () use ($contract, $data) {
            $room = Room::whereKey($contract->room_id)->lockForUpdate()->firstOrFail();
            $contract->refresh();
            if ($contract->status !== 'active') {
                throw ValidationException::withMessages(['status' => 'Only an active tenancy can be ended.']);
            }
            $contract->update($data + ['status' => 'ended', 'active_room_id' => null]);
            $room->update(['status' => 'unverified']);
        });

        return response()->json($contract->fresh()->load('tenant', 'room.building', 'files', 'previousContract'));
    }

    public function upload(Request $request, Contract $contract): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:10240']]);
        $file = $request->file('file');
        $path = $file->store('signed-contracts/'.$contract->id, 'local');
        $version = $contract->files()->create(['path' => $path, 'original_name' => $file->getClientOriginalName(), 'uploaded_by' => $request->user()->id]);

        return response()->json($version, 201);
    }

    public function download(Contract $contract, ContractFile $file)
    {
        abort_unless($file->contract_id === $contract->id && Storage::disk('local')->exists($file->path), 404);

        return Storage::disk('local')->download($file->path, $file->original_name, ['Content-Type' => 'application/pdf', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
