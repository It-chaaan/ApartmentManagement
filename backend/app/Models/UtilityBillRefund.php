<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityBillRefund extends Model
{
    protected $fillable = ['utility_bill_id', 'amount', 'refunded_on', 'method', 'reference', 'reason', 'approved_by', 'voided_at', 'voided_by', 'void_reason'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'refunded_on' => 'date:Y-m-d', 'voided_at' => 'datetime'];
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->select('id', 'name');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->select('id', 'name');
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(UtilityBill::class, 'utility_bill_id');
    }
}
