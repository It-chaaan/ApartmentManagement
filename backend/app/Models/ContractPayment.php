<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractPayment extends Model
{
    protected $fillable = ['contract_id', 'recorded_by', 'kind', 'period_month', 'paid_on', 'amount', 'method', 'reference', 'notes', 'submission_key'];

    protected function casts(): array
    {
        return ['period_month' => 'date:Y-m-d', 'paid_on' => 'date:Y-m-d', 'amount' => 'decimal:2'];
    }

    public function recorder(): BelongsTo { return $this->belongsTo(User::class, 'recorded_by')->select('id', 'name'); }
}
