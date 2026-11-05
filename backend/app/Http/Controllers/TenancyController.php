<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractFile;
use App\Models\Room;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
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
        if (isset($data['previous_contract_id'])) {
            $previous = Contract::findOrFail($data['previous_contract_id']);
            if ($previous->tenant_id !== (int) $data['tenant_id'] || $previous->room_id !== (int) $data['room_id'] || $previous->status === 'draft') {
                throw ValidationException::withMessages(['previous_contract_id' => 'A renewal must follow a signed contract for the same tenant and room.']);
            }
            if (Contract::where('previous_contract_id', $previous->id)->exists()) {
                throw ValidationException::withMessages(['previous_contract_id' => 'This contract already has a renewal record.']);
            }
        }
        $contract = Contract::create($data + ['status' => 'draft']);
        return response()->json($contract->load('tenant', 'room.building', 'files', 'previousContract'), 201);
    }

    public function moveIn(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'moved_in_on' => ['required', 'date_format:Y-m-d'],
            'advance_paid' => ['required', 'numeric', 'gte:0', 'max:99999999.99'],
            'deposit_paid' => ['required', 'numeric', 'gte:0', 'max:99999999.99'],
            'signing_paid_on' => ['nullable', 'date_format:Y-m-d'],
            'advance_method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'deposit_method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'signing_reference' => ['nullable', 'string', 'max:120'],
            'signing_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        DB::transaction(function () use ($contract, $data, $request) {
            $room = Room::whereKey($contract->room_id)->lockForUpdate()->firstOrFail();
            $contract->refresh();
            if ($contract->status !== 'draft') {
                throw ValidationException::withMessages(['status' => 'Only a draft contract can start a tenancy.']);
            }
            if ((float) $data['advance_paid'] > (float) $contract->advance_amount || (float) $data['deposit_paid'] > (float) $contract->deposit_amount) {
                throw ValidationException::withMessages(['advance_paid' => 'Signing payments cannot exceed the agreed advance or deposit.']);
            }
            $active = Contract::where('active_room_id', $room->id)->lockForUpdate()->first();
            if ($active) {
                if ($contract->previous_contract_id !== $active->id || $contract->tenant_id !== $active->tenant_id) {
                    throw ValidationException::withMessages(['room_id' => 'This room already has an active tenancy.']);
                }
                $active->update(['status' => 'renewed', 'active_room_id' => null, 'ended_on' => $data['moved_in_on'], 'end_review_note' => 'Superseded by renewal contract #'.$contract->id]);
            } elseif ($contract->previous_contract_id) {
                throw ValidationException::withMessages(['previous_contract_id' => 'The earlier tenancy is no longer active. Review the room before moving in.']);
            } elseif (! in_array($room->status, ['available', 'reserved'], true)) {
                throw ValidationException::withMessages(['room_id' => 'Confirm the room as available or reserved before starting a tenancy.']);
            }
            $contract->update(array_intersect_key($data, array_flip(['moved_in_on', 'advance_paid', 'deposit_paid'])) + ['status' => 'active', 'active_room_id' => $room->id]);
            foreach (['advance' => 'advance_paid', 'deposit' => 'deposit_paid'] as $kind => $field) {
                if ((float) $data[$field] <= 0) {
                    continue;
                }
                $contract->payments()->create([
                    'recorded_by' => $request->user()->id, 'kind' => $kind,
                    'paid_on' => $data['signing_paid_on'] ?? $data['moved_in_on'],
                    'amount' => $data[$field], 'method' => $data[$kind.'_method'] ?? 'not_recorded',
                    'reference' => $data['signing_reference'] ?? null,
                    'notes' => $data['signing_notes'] ?? null,
                    'submission_key' => (string) Str::uuid(),
                ]);
            }
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
