<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityBillPayment extends Model
{
    protected $fillable = ['utility_bill_id', 'recorded_by', 'paid_on', 'amount', 'method', 'reference', 'notes', 'submission_key', 'voided_at', 'voided_by', 'void_reason'];

    protected $hidden = ['submission_key'];

    protected function casts(): array
    {
        return ['paid_on' => 'date:Y-m-d', 'amount' => 'decimal:2', 'voided_at' => 'datetime'];
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by')->select('id', 'name');
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
