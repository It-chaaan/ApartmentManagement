<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractAdjustment;
use App\Models\RoomInspection;
use App\Models\UtilityBill;
use App\Models\UtilityBillRefund;
use App\Services\RentLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettlementController extends Controller
{
    public function storeContractAdjustment(Request $request, Contract $contract, RentLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['rent_refund', 'advance_refund', 'deposit_refund', 'deposit_deduction'])],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'occurred_on' => ['required', 'date_format:Y-m-d'],
            'method' => ['required_unless:kind,deposit_deduction', 'nullable', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
            'inspection_id' => ['required_if:kind,deposit_deduction', 'nullable', 'integer', 'exists:room_inspections,id'],
        ]);
        $adjustment = DB::transaction(function () use ($request, $contract, $ledger, $data): ContractAdjustment {
            $contract = Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $kind = $data['kind'];
            if ($kind !== 'rent_refund' && $contract->status !== 'ended') {
                throw ValidationException::withMessages(['kind' => 'Advance and deposit settlement requires an ended tenancy.']);
            }
            if ($kind !== 'rent_refund' && $data['occurred_on'] < $contract->ended_on->format('Y-m-d')) {
                throw ValidationException::withMessages(['occurred_on' => 'Settlement cannot predate tenancy end.']);
            }
            if ($kind === 'deposit_deduction') {
                $inspection = RoomInspection::with('items', 'photos')->whereKey($data['inspection_id'])
                    ->where('room_id', $contract->room_id)->where('contract_id', $contract->id)->where('type', 'move_out')->first();
                if (! $inspection || ! $inspection->items->contains('condition', 'needs_repair') || $inspection->photos->isEmpty()) {
                    throw ValidationException::withMessages(['inspection_id' => 'Link a move-out checklist with a repair item and private photo.']);
                }
            }
            $summary = $ledger->forContract($contract->load('payments', 'adjustments'));
            $balanceField = match ($kind) {
                'rent_refund' => 'rent_credit',
                'advance_refund' => 'advance_refundable',
                default => 'deposit_refundable',
            };
            if ((int) round((float) $data['amount'] * 100) > (int) round((float) $summary[$balanceField] * 100)) {
                throw ValidationException::withMessages(['amount' => 'Adjustment exceeds the available '.$balanceField.' balance.']);
            }

            return $contract->adjustments()->create([
                ...$data, 'method' => $kind === 'deposit_deduction' ? null : $data['method'],
                'inspection_id' => $kind === 'deposit_deduction' ? $data['inspection_id'] : null,
                'approved_by' => $request->user()->id,
            ]);
        });

        return response()->json($adjustment->load('approver', 'inspection'), 201);
    }

    public function voidContractAdjustment(Request $request, Contract $contract, ContractAdjustment $adjustment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        DB::transaction(function () use ($request, $contract, $adjustment, $data): void {
            Contract::whereKey($contract->id)->lockForUpdate()->firstOrFail();
            $adjustment = ContractAdjustment::whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
            abort_unless($adjustment->contract_id === $contract->id, 404);
            if ($adjustment->voided_at) {
                throw ValidationException::withMessages(['adjustment' => 'This adjustment is already voided.']);
            }
            $adjustment->update(['voided_at' => now(), 'voided_by' => $request->user()->id, 'void_reason' => $data['reason']]);
        });

        return response()->json(['message' => 'Adjustment voided; original record retained.']);
    }

    public function storeUtilityRefund(Request $request, UtilityBill $utilityBill): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'refunded_on' => ['required', 'date_format:Y-m-d'],
            'method' => ['required', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);
        $refund = DB::transaction(function () use ($request, $utilityBill, $data): UtilityBillRefund {
            $bill = UtilityBill::whereKey($utilityBill->id)->lockForUpdate()->firstOrFail();
            $paidCents = (int) round((float) $bill->payments()->whereNull('voided_at')->sum('amount') * 100);
            $refundedCents = (int) round((float) $bill->refunds()->whereNull('voided_at')->sum('amount') * 100);
            $creditCents = max(0, $paidCents - (int) round((float) $bill->amount * 100) - $refundedCents);
            if ((int) round((float) $data['amount'] * 100) > $creditCents) {
                throw ValidationException::withMessages(['amount' => 'Refund exceeds the bill overpayment.']);
            }

            return $bill->refunds()->create([...$data, 'approved_by' => $request->user()->id]);
        });

        return response()->json($refund->load('approver'), 201);
    }

    public function voidUtilityRefund(Request $request, UtilityBill $utilityBill, UtilityBillRefund $refund): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        DB::transaction(function () use ($request, $utilityBill, $refund, $data): void {
            UtilityBill::whereKey($utilityBill->id)->lockForUpdate()->firstOrFail();
            $refund = UtilityBillRefund::whereKey($refund->id)->lockForUpdate()->firstOrFail();
            abort_unless($refund->utility_bill_id === $utilityBill->id, 404);
            if ($refund->voided_at) {
                throw ValidationException::withMessages(['refund' => 'This refund is already voided.']);
            }
            $refund->update(['voided_at' => now(), 'voided_by' => $request->user()->id, 'void_reason' => $data['reason']]);
        });

        return response()->json(['message' => 'Refund voided; original record retained.']);
    }
}
