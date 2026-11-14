<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityMeterCharge extends Model
{
    protected $fillable = [
        'room_id', 'kind', 'period_month', 'previous_read_on', 'current_read_on',
        'previous_reading', 'current_reading', 'units_used', 'rate_per_unit', 'amount',
        'due_on', 'history', 'created_by', 'approved_by', 'approved_at', 'utility_bill_id',
    ];

    protected function casts(): array
    {
        return [
            'period_month' => 'date:Y-m-d', 'previous_read_on' => 'date:Y-m-d',
            'current_read_on' => 'date:Y-m-d', 'due_on' => 'date:Y-m-d',
            'previous_reading' => 'decimal:3', 'current_reading' => 'decimal:3',
            'units_used' => 'decimal:3', 'rate_per_unit' => 'decimal:4',
            'amount' => 'decimal:2', 'history' => 'array', 'approved_at' => 'datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class)->with('building:id,name');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(UtilityBill::class, 'utility_bill_id');
    }
}
