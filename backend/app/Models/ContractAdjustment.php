<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractAdjustment extends Model
{
    protected $fillable = ['contract_id', 'kind', 'amount', 'occurred_on', 'method', 'reference', 'reason', 'inspection_id', 'approved_by', 'voided_at', 'voided_by', 'void_reason'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'occurred_on' => 'date:Y-m-d', 'voided_at' => 'datetime'];
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->select('id', 'name');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->select('id', 'name');
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(RoomInspection::class, 'inspection_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
