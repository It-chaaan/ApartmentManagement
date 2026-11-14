<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\UtilityBill;
use App\Models\UtilityMeterCharge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UtilityMeterChargeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(UtilityMeterCharge::with('room.building', 'creator:id,name', 'approver:id,name')
            ->orderByDesc('period_month')->orderByDesc('id')->get()->map(fn (UtilityMeterCharge $charge): array => $this->chargeData($charge)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedReading($request);
        $charge = DB::transaction(function () use ($request, $data): UtilityMeterCharge {
            Room::whereKey($data['room_id'])->lockForUpdate()->firstOrFail();
            $this->assertUniquePeriod($data['room_id'], $data['kind'], $data['period_month']);
            $this->assertReadingSequence($data);
            [$units, $amount] = $this->calculate($data);

            return UtilityMeterCharge::create([
                ...$data, 'period_month' => $data['period_month'].'-01',
                'units_used' => $units, 'amount' => $amount, 'created_by' => $request->user()->id,
            ]);
        });

        return response()->json($this->chargeData($charge->load('room.building', 'creator:id,name', 'approver:id,name')), 201);
    }

    public function correct(Request $request, UtilityMeterCharge $charge): JsonResponse
    {
        $data = $this->validatedReading($request);
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']])['reason'];
        DB::transaction(function () use ($request, $charge, $data, $reason): void {
            $charge = UtilityMeterCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            $keyChanged = $charge->room_id !== (int) $data['room_id'] || $charge->kind !== $data['kind'] || $charge->period_month->format('Y-m') !== $data['period_month'];
            if ($keyChanged && $charge->utility_bill_id) {
                throw ValidationException::withMessages(['period_month' => 'A correction must keep the same room, utility, and billing month.']);
            }
            if ($keyChanged) {
                Room::whereKey($data['room_id'])->lockForUpdate()->firstOrFail();
                $this->assertUniquePeriod($data['room_id'], $data['kind'], $data['period_month'], $charge->id);
            }
            $this->assertReadingSequence($data, $charge->id);
            [$units, $amount] = $this->calculate($data);
            $history = $charge->history ?? [];
            $history[] = [
                'reason' => $reason, 'corrected_at' => now()->toIso8601String(),
                'corrected_by' => ['id' => $request->user()->id, 'name' => $request->user()->name],
                'previous_approval' => $charge->approved_at ? ['by' => $charge->approver?->name, 'at' => $charge->approved_at->toIso8601String()] : null,
                'previous' => collect($charge->only([
                    'room_id', 'kind', 'period_month', 'previous_read_on', 'current_read_on', 'previous_reading', 'current_reading',
                    'units_used', 'rate_per_unit', 'amount', 'due_on',
                ]))->map(fn ($value) => $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value)->all(),
            ];
            $charge->update([...$data, 'period_month' => $data['period_month'].'-01',
                'units_used' => $units, 'amount' => $amount, 'history' => $history,
                'approved_by' => null, 'approved_at' => null]);
        });

        return response()->json($this->chargeData($charge->fresh()->load('room.building', 'creator:id,name', 'approver:id,name')));
    }

    public function approve(Request $request, UtilityMeterCharge $charge): JsonResponse
    {
        DB::transaction(function () use ($request, $charge): void {
            $charge = UtilityMeterCharge::whereKey($charge->id)->lockForUpdate()->firstOrFail();
            if ($charge->approved_at) {
                throw ValidationException::withMessages(['charge' => 'This meter charge has already been posted.']);
            }
            $period = $charge->period_month->format('Y-m-d');
            if (! $charge->utility_bill_id && UtilityBill::where('room_id', $charge->room_id)->where('kind', $charge->kind)->whereDate('period_month', $period)->exists()) {
                throw ValidationException::withMessages(['period_month' => 'A bill for this room, utility, and month already exists.']);
            }
            $this->assertReadingSequence([
                'room_id' => $charge->room_id, 'kind' => $charge->kind, 'period_month' => $charge->period_month->format('Y-m'),
                'previous_read_on' => $charge->previous_read_on->format('Y-m-d'),
                'previous_reading' => $charge->previous_reading,
            ], $charge->id);
            if ($charge->utility_bill_id) {
                $bill = UtilityBill::whereKey($charge->utility_bill_id)->lockForUpdate()->firstOrFail();
                $paidCents = $this->moneyCents((string) $bill->payments()->whereNull('voided_at')->sum('amount'));
                $refundedCents = $this->moneyCents((string) $bill->refunds()->whereNull('voided_at')->sum('amount'));
                if ($refundedCents > max(0, $paidCents - $this->moneyCents($charge->amount))) {
                    throw ValidationException::withMessages(['amount' => 'Void affected refunds before approving the revised bill.']);
                }
                $bill->update(['amount' => $charge->amount, 'due_on' => $charge->due_on,
                    'file_needs_review' => (bool) $bill->file_path]);
            } else {
                $bill = UtilityBill::create([
                    'room_id' => $charge->room_id, 'kind' => $charge->kind, 'period_month' => $period,
                    'due_on' => $charge->due_on, 'amount' => $charge->amount,
                    'notes' => 'Calculated from recorded meter readings. See meter charge #'.$charge->id.'.',
                    'created_by' => $request->user()->id,
                ]);
            }
            $charge->update(['utility_bill_id' => $bill->id, 'approved_by' => $request->user()->id, 'approved_at' => now()]);
        });

        return response()->json($this->chargeData($charge->fresh()->load('room.building', 'creator:id,name', 'approver:id,name')));
    }

    private function validatedReading(Request $request): array
    {
        $data = $request->validate([
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'kind' => ['required', Rule::in(['electricity', 'water'])],
            'period_month' => ['required', 'date_format:Y-m'],
            'previous_read_on' => ['required', 'date_format:Y-m-d'],
            'current_read_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'previous_reading' => ['required', 'numeric', 'decimal:0,3', 'min:0', 'max:999999.999'],
            'current_reading' => ['required', 'numeric', 'decimal:0,3', 'min:0', 'max:999999.999'],
            'rate_per_unit' => ['required', 'numeric', 'decimal:0,4', 'gt:0', 'max:999.9999'],
            'due_on' => ['required', 'date_format:Y-m-d'],
        ]);
        if ($data['previous_read_on'] >= $data['current_read_on'] || $data['current_read_on'] > $data['due_on']) {
            throw ValidationException::withMessages(['current_read_on' => 'Reading dates must increase, and the due date must follow the current reading.']);
        }
        if (substr($data['current_read_on'], 0, 7) !== $data['period_month']) {
            throw ValidationException::withMessages(['period_month' => 'The billing month must match the current reading date.']);
        }
        if ($this->scaled((string) $data['current_reading'], 3) < $this->scaled((string) $data['previous_reading'], 3)) {
            throw ValidationException::withMessages(['current_reading' => 'The current meter reading cannot be below the previous reading.']);
        }

        return $data;
    }

    private function assertUniquePeriod(int $roomId, string $kind, string $periodMonth, ?int $excludeId = null): void
    {
        $period = $periodMonth.'-01';
        if (UtilityMeterCharge::where('room_id', $roomId)->where('kind', $kind)->whereDate('period_month', $period)
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))->exists()
            || UtilityBill::where('room_id', $roomId)->where('kind', $kind)->whereDate('period_month', $period)->exists()) {
            throw ValidationException::withMessages(['period_month' => 'A charge or bill for this room, utility, and month already exists.']);
        }
    }

    private function assertReadingSequence(array $data, ?int $excludeId = null): void
    {
        if (UtilityMeterCharge::where('room_id', $data['room_id'])->where('kind', $data['kind'])
            ->where('period_month', '>', $data['period_month'].'-01')->whereNotNull('approved_at')->exists()) {
            throw ValidationException::withMessages(['period_month' => 'A later meter charge is already posted. Correct that period first.']);
        }
        $prior = UtilityMeterCharge::where('room_id', $data['room_id'])->where('kind', $data['kind'])
            ->where('period_month', '<', $data['period_month'].'-01')->whereNotNull('approved_at')
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->orderByDesc('period_month')->first();
        if (! $prior) {
            return;
        }
        if ($prior->current_read_on->format('Y-m-d') !== $data['previous_read_on']
            || $this->scaled($prior->current_reading, 3) !== $this->scaled((string) $data['previous_reading'], 3)) {
            throw ValidationException::withMessages(['previous_reading' => 'Use the preceding posted reading and its date as this period’s starting point.']);
        }
    }

    private function calculate(array $data): array
    {
        $unitsMilli = $this->scaled((string) $data['current_reading'], 3) - $this->scaled((string) $data['previous_reading'], 3);
        $rateTenThousand = $this->scaled((string) $data['rate_per_unit'], 4);
        $amountCents = intdiv($unitsMilli * $rateTenThousand + 50000, 100000);
        if ($amountCents > 9999999999) {
            throw ValidationException::withMessages(['rate_per_unit' => 'Calculated amount exceeds the maximum bill amount.']);
        }

        return [number_format($unitsMilli / 1000, 3, '.', ''), number_format($amountCents / 100, 2, '.', '')];
    }

    private function scaled(string $value, int $places): int
    {
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');

        return (int) $whole * 10 ** $places + (int) str_pad($fraction, $places, '0');
    }

    private function moneyCents(string $value): int
    {
        return $this->scaled(number_format((float) $value, 2, '.', ''), 2);
    }

    private function chargeData(UtilityMeterCharge $charge): array
    {
        return [
            'id' => $charge->id, 'room_id' => $charge->room_id,
            'room' => ['code' => $charge->room->code, 'building_id' => $charge->room->building_id, 'building' => ['name' => $charge->room->building->name]],
            'kind' => $charge->kind, 'period_month' => $charge->period_month->format('Y-m'),
            'previous_read_on' => $charge->previous_read_on->format('Y-m-d'), 'current_read_on' => $charge->current_read_on->format('Y-m-d'),
            'previous_reading' => $charge->previous_reading, 'current_reading' => $charge->current_reading,
            'units_used' => $charge->units_used, 'unit' => $charge->kind === 'electricity' ? 'kWh' : 'm³',
            'rate_per_unit' => $charge->rate_per_unit, 'amount' => $charge->amount, 'due_on' => $charge->due_on->format('Y-m-d'),
            'status' => $charge->approved_at ? 'posted' : ($charge->utility_bill_id ? 'revision' : 'draft'), 'utility_bill_id' => $charge->utility_bill_id,
            'created_by' => $charge->creator->name, 'approved_by' => $charge->approver?->name,
            'approved_at' => $charge->approved_at?->toIso8601String(), 'history' => $charge->history ?? [],
        ];
    }
}
