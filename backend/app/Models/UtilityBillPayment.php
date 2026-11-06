<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityBillPayment extends Model
{
    protected $fillable = ['utility_bill_id', 'recorded_by', 'paid_on', 'amount', 'method', 'reference', 'notes', 'submission_key'];

    protected $hidden = ['submission_key'];

    protected function casts(): array
    {
        return ['paid_on' => 'date:Y-m-d', 'amount' => 'decimal:2'];
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by')->select('id', 'name');
    }
}
