<?php

namespace App\Http\Controllers;

use App\Models\UtilityBill;
use App\Models\UtilityBillPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UtilityBillController extends Controller
{
    public function index(): JsonResponse
    {
        $bills = UtilityBill::with(['room.building', 'payments.recorder', 'payments.voider', 'refunds'])
            ->orderByDesc('period_month')->orderByDesc('id')->get();

        return response()->json($bills->map(fn (UtilityBill $bill): array => $this->billData($bill)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'kind' => ['required', Rule::in(['electricity', 'water'])],
            'period_month' => ['required', 'date_format:Y-m'],
            'due_on' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'account_reference' => ['nullable', 'string', 'max:120'],
            'delivered_on' => ['nullable', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $periodMonth = $data['period_month'].'-01';
        if (UtilityBill::where('room_id', $data['room_id'])->where('kind', $data['kind'])->whereDate('period_month', $periodMonth)->exists()) {
            throw ValidationException::withMessages(['period_month' => 'A bill for this room, utility, and month already exists.']);
        }
        $bill = UtilityBill::create([
            ...$data,
            'period_month' => $periodMonth,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($this->billData($bill->load(['room.building', 'payments.recorder', 'payments.voider', 'refunds'])), 201);
    }

    public function recordPayment(Request $request, UtilityBill $utilityBill): JsonResponse
    {
        $data = $request->validate([
            'submission_key' => ['required', 'uuid'],
            'paid_on' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'method' => ['required', Rule::in(['cash', 'bank_transfer', 'gcash', 'other'])],
            'reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $utilityBill, $data): void {
            $bill = UtilityBill::whereKey($utilityBill->id)->lockForUpdate()->firstOrFail();
            $existing = UtilityBillPayment::where('submission_key', $data['submission_key'])->first();
            if ($existing) {
                if ($existing->voided_at || $existing->utility_bill_id !== $bill->id || $existing->amount !== number_format((float) $data['amount'], 2, '.', '')
                    || $existing->paid_on->format('Y-m-d') !== $data['paid_on'] || $existing->method !== $data['method']
                    || $existing->reference !== ($data['reference'] ?? null) || $existing->notes !== ($data['notes'] ?? null)) {
                    throw ValidationException::withMessages(['submission_key' => 'This submission key belongs to another payment.']);
                }

                return;
            }
            $bill->payments()->create([...$data, 'recorded_by' => $request->user()->id]);
        });

        return response()->json($this->billData($utilityBill->fresh()->load(['room.building', 'payments.recorder', 'payments.voider', 'refunds'])));
    }

    public function voidPayment(Request $request, UtilityBill $utilityBill, UtilityBillPayment $payment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        DB::transaction(function () use ($request, $utilityBill, $payment, $data): void {
            $bill = UtilityBill::whereKey($utilityBill->id)->lockForUpdate()->firstOrFail();
            $payment = UtilityBillPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($payment->utility_bill_id !== $bill->id || $payment->voided_at) {
                throw ValidationException::withMessages(['payment' => 'This payment cannot be corrected.']);
            }
            $paidCents = (int) round((float) $bill->payments()->whereNull('voided_at')->sum('amount') * 100);
            $refundedCents = (int) round((float) $bill->refunds()->whereNull('voided_at')->sum('amount') * 100);
            if ($paidCents - (int) round((float) $payment->amount * 100) < (int) round((float) $bill->amount * 100) + $refundedCents && $refundedCents > 0) {
                throw ValidationException::withMessages(['payment' => 'A refund already uses this overpayment. Void the refund first.']);
            }
            $payment->update(['voided_at' => now(), 'voided_by' => $request->user()->id, 'void_reason' => $data['reason']]);
        });

        return response()->json($this->billData($utilityBill->fresh()->load(['room.building', 'payments.recorder', 'payments.voider', 'refunds'])));
    }

    public function upload(Request $request, UtilityBill $utilityBill): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:10240']]);
        $previousPath = $utilityBill->file_path;
        $file = $request->file('file');
        $path = $file->store('utility-bills/'.$utilityBill->id, 'local');
        $utilityBill->update(['file_path' => $path, 'file_name' => $file->getClientOriginalName()]);
        if ($previousPath) {
            Storage::disk('local')->delete($previousPath);
        }

        return response()->json($this->billData($utilityBill->fresh()->load(['room.building', 'payments.recorder', 'payments.voider', 'refunds'])));
    }

    public function download(UtilityBill $utilityBill): StreamedResponse
    {
        abort_unless($utilityBill->file_path && Storage::disk('local')->exists($utilityBill->file_path), 404);

        return Storage::disk('local')->download($utilityBill->file_path, $utilityBill->file_name, [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function billData(UtilityBill $bill): array
    {
        $paidCents = $bill->payments->whereNull('voided_at')->sum(fn (UtilityBillPayment $payment): int => (int) round((float) $payment->amount * 100));
        $billCents = (int) round((float) $bill->amount * 100);
        $balanceCents = max(0, $billCents - $paidCents);
        $refundedCents = $bill->refunds->whereNull('voided_at')->sum(fn ($refund): int => (int) round((float) $refund->amount * 100));
        $creditCents = max(0, $paidCents - $billCents - $refundedCents);

        return [
            'id' => $bill->id,
            'room_id' => $bill->room_id,
            'room' => ['code' => $bill->room->code, 'building_id' => $bill->room->building_id, 'building' => ['name' => $bill->room->building->name]],
            'kind' => $bill->kind,
            'period_month' => $bill->period_month->format('Y-m'),
            'due_on' => $bill->due_on->format('Y-m-d'),
            'amount' => $bill->amount,
            'paid_amount' => number_format($paidCents / 100, 2, '.', ''),
            'balance' => number_format($balanceCents / 100, 2, '.', ''),
            'credit_available' => number_format($creditCents / 100, 2, '.', ''),
            'refunded_amount' => number_format($refundedCents / 100, 2, '.', ''),
            'status' => $creditCents > 0 ? 'overpaid' : ($balanceCents === 0 ? 'paid' : ($paidCents > 0 ? 'partial' : ($bill->due_on->isBefore(today()) ? 'overdue' : 'unpaid'))),
            'account_reference' => $bill->account_reference,
            'delivered_on' => $bill->delivered_on?->format('Y-m-d'),
            'notes' => $bill->notes,
            'file_name' => $bill->file_name,
            'payments' => $bill->payments->map(fn (UtilityBillPayment $payment): array => [
                'id' => $payment->id, 'paid_on' => $payment->paid_on->format('Y-m-d'),
                'amount' => $payment->amount, 'method' => $payment->method,
                'reference' => $payment->reference, 'notes' => $payment->notes,
                'recorder' => ['name' => $payment->recorder->name],
                'voided_at' => $payment->voided_at?->toIso8601String(), 'void_reason' => $payment->void_reason,
                'voider' => $payment->voider ? ['name' => $payment->voider->name] : null,
            ]),
            'refunds' => $bill->refunds,
        ];
    }
}
