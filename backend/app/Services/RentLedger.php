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
        $payments = $contract->payments;
        $rentByMonth = $payments->where('kind', 'rent')->groupBy(fn ($payment) => $payment->period_month->format('Y-m'));
        $months = [];
        $dueCents = 0;
        $paidCents = 0;
        $month = $start->startOfMonth();
        for ($i = 0; $month->lte($lastMonth) && $i < 1200; $i++, $month = $month->addMonth()) {
            $due = $month->day(min((int) $contract->due_day, $month->daysInMonth));
            if ($due->lt($start)) {
                $due = $start;
            }
            $amount = $this->cents($contract->monthly_rent);
            $paid = $rentByMonth->get($month->format('Y-m'), collect())->sum(fn ($payment) => $this->cents($payment->amount));
            $balance = max(0, $amount - $paid);
            if ($due->lte($today)) {
                $dueCents += $amount;
                $paidCents += $paid;
            }
            $months[] = [
                'period_month' => $month->format('Y-m'), 'due_on' => $due->format('Y-m-d'),
                'amount' => $this->money($amount), 'paid' => $this->money($paid),
                'balance' => $this->money($balance), 'is_due' => $due->lte($today),
            ];
        }

        return [
            'contract_id' => $contract->id, 'installments' => $months,
            'due_balance' => $this->money(max(0, $dueCents - $paidCents)),
            'advance_paid' => $this->money($payments->where('kind', 'advance')->sum(fn ($payment) => $this->cents($payment->amount))),
            'deposit_paid' => $this->money($payments->where('kind', 'deposit')->sum(fn ($payment) => $this->cents($payment->amount))),
            'payments' => $payments->sortByDesc('id')->values(),
        ];
    }

    private function cents(string $amount): int { return (int) round((float) $amount * 100); }
    private function money(int $cents): string { return number_format($cents / 100, 2, '.', ''); }
}
