<?php

namespace App\Services;

use App\Models\Contract;
use Carbon\CarbonImmutable;

class RentLedger
{
    public function forContract(Contract $contract): array
    {
        $today = CarbonImmutable::today();
        $start = CarbonImmutable::parse($contract->starts_on);
        $end = CarbonImmutable::parse($contract->ended_on ?: $contract->ends_on);
        $lastMonth = $end->startOfMonth();
        $renewal = Contract::where('previous_contract_id', $contract->id)->whereIn('status', ['signed', 'active', 'renewed'])->first();
        if ($renewal && $renewal->starts_on->startOfMonth()->lte($lastMonth)) {
            $lastMonth = CarbonImmutable::parse($renewal->starts_on)->startOfMonth()->subMonth();
        }
        $payments = $contract->payments;
        $rentByMonth = $payments->where('kind', 'rent')->groupBy(fn ($payment) => $payment->period_month->format('Y-m'));
        $advancePaid = $payments->where('kind', 'advance')->sum(fn ($payment) => $this->cents($payment->amount))
            - $payments->where('kind', 'advance_transfer_out')->sum(fn ($payment) => $this->cents($payment->amount));
        $advanceRemaining = $advancePaid;
        // Hold the advance during an active tenancy. On move-out it covers only unpaid final-month rent.
        $finalMonth = $contract->status === 'ended' ? $lastMonth->format('Y-m') : null;
        $months = [];
        $dueCents = 0;
        $month = $start->startOfMonth();
        for ($i = 0; $month->lte($lastMonth) && $i < 1200; $i++, $month = $month->addMonth()) {
            $due = $month->day(min((int) $contract->due_day, $month->daysInMonth));
            if ($due->lt($start)) {
                $due = $start;
            }
            $amount = $this->cents($contract->monthly_rent);
            $paid = $rentByMonth->get($month->format('Y-m'), collect())->sum(fn ($payment) => $this->cents($payment->amount));
            $advanceApplied = $month->format('Y-m') === $finalMonth
                ? min($advanceRemaining, max(0, $amount - $paid)) : 0;
            $advanceRemaining -= $advanceApplied;
            $balance = max(0, $amount - $paid - $advanceApplied);
            if ($due->lte($today)) {
                $dueCents += $balance;
            }
            $months[] = [
                'period_month' => $month->format('Y-m'), 'due_on' => $due->format('Y-m-d'),
                'amount' => $this->money($amount), 'paid' => $this->money($paid),
                'advance_applied' => $this->money($advanceApplied),
                'balance' => $this->money($balance), 'is_due' => $due->lte($today),
            ];
        }

        return [
            'contract_id' => $contract->id, 'installments' => $months,
            'due_balance' => $this->money($dueCents),
            'advance_paid' => $this->money($advancePaid),
            'advance_applied' => $this->money($advancePaid - $advanceRemaining),
            'advance_remaining' => $this->money($advanceRemaining),
            'deposit_paid' => $this->money($payments->where('kind', 'deposit')->sum(fn ($payment) => $this->cents($payment->amount))
                - $payments->where('kind', 'deposit_transfer_out')->sum(fn ($payment) => $this->cents($payment->amount))),
            'payments' => $payments->sortByDesc('id')->values(),
        ];
    }

    private function cents(string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
