<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\Room;
use App\Services\RentLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ContractSigningController extends Controller
{
    public function store(Request $request, Contract $contract, RentLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'signed_on' => ['required', 'date_format:Y-m-d'],
            'received_full_payment' => ['required', 'accepted'],
            'method' => ['required', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $contract, $ledger, $data): void {
            $room = Room::whereKey($contract->room_id)->lockForUpdate()->firstOrFail();
            $contract = Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            if ($contract->status !== 'draft') {
                throw ValidationException::withMessages(['status' => 'Only a draft contract can be signed.']);
            }
            if ($data['signed_on'] > $contract->ends_on->format('Y-m-d')) {
                throw ValidationException::withMessages(['signed_on' => 'Signing cannot be after the contract ends.']);
            }

            $carriedAdvance = 0;
            $carriedDeposit = 0;
            $carriedRent = 0;
            $previous = null;
            if ($contract->previous_contract_id) {
                $previous = Contract::whereKey($contract->previous_contract_id)->lockForUpdate()->firstOrFail();
                if ($previous->status !== 'active' || $previous->active_room_id !== $room->id || $previous->tenant_id !== $contract->tenant_id) {
                    throw ValidationException::withMessages(['previous_contract_id' => 'The earlier tenancy must still be active for this tenant and room.']);
                }
                $previousLedger = $ledger->forContract($previous->load('payments'));
                $carriedAdvance = $this->cents($previousLedger['advance_remaining']);
                $carriedDeposit = $this->cents($previousLedger['deposit_paid']);
                $overlapMonth = $contract->starts_on->startOfMonth()->toDateString();
                $carriedRent = $this->cents((string) $previous->payments()->whereNull('voided_at')->where('kind', 'rent')->whereDate('period_month', $overlapMonth)->sum('amount'));
                if ($carriedRent > $this->cents($contract->monthly_rent)) {
                    throw ValidationException::withMessages(['monthly_rent' => 'The earlier contract has more rent paid for the renewal month than the new rent. Review the credit before signing.']);
                }
            } elseif (! in_array($room->status, ['available', 'reserved'], true)
                || Contract::where('active_room_id', $room->id)->exists()
                || Contract::where('room_id', $room->id)->where('status', 'signed')->exists()) {
                throw ValidationException::withMessages(['room_id' => 'Confirm this room as available or reserved before signing.']);
            }

            $advanceDue = $this->cents($contract->advance_amount) - $carriedAdvance;
            $depositDue = $this->cents($contract->deposit_amount) - $carriedDeposit;
            if ($advanceDue < 0 || $depositDue < 0) {
                throw ValidationException::withMessages(['advance_amount' => 'The renewal cannot reduce a carried advance or deposit without a separate settlement.']);
            }

            if ($carriedRent > 0 && $previous) {
                $transfer = [
                    'recorded_by' => $request->user()->id,
                    'period_month' => $overlapMonth,
                    'paid_on' => $data['signed_on'],
                    'amount' => number_format($carriedRent / 100, 2, '.', ''),
                    'method' => 'carryover',
                    'reference' => 'Contract #'.$previous->id.' → #'.$contract->id,
                    'submission_key' => (string) Str::uuid(),
                ];
                $previous->payments()->create($transfer + ['kind' => 'rent_transfer_out']);
                $contract->payments()->create([...$transfer, 'kind' => 'rent', 'submission_key' => (string) Str::uuid()]);
            }

            foreach (['advance' => $advanceDue, 'deposit' => $depositDue, 'rent' => $this->cents($contract->monthly_rent) - $carriedRent] as $kind => $amount) {
                if ($amount === 0) {
                    continue;
                }
                $contract->payments()->create([
                    'recorded_by' => $request->user()->id,
                    'kind' => $kind,
                    'period_month' => $kind === 'rent' ? $contract->starts_on->startOfMonth()->toDateString() : null,
                    'paid_on' => $data['signed_on'],
                    'amount' => number_format($amount / 100, 2, '.', ''),
                    'method' => $data['method'],
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'submission_key' => (string) Str::uuid(),
                ]);
            }

            $contract->update([
                'signed_on' => $data['signed_on'],
                'signing_recorded_at' => now(),
                'signing_recorded_by' => $request->user()->id,
                'advance_paid' => number_format($advanceDue / 100, 2, '.', ''),
                'deposit_paid' => number_format($depositDue / 100, 2, '.', ''),
                'status' => 'signed',
            ]);
            if (! $contract->previous_contract_id) {
                $room->update(['status' => 'reserved']);
            }
        });

        return response()->json($contract->fresh()->load('tenant', 'room.building', 'files', 'previousContract'));
    }

    private function cents(string $amount): int
    {
        return (int) round((float) $amount * 100);
    }
}
