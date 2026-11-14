<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UtilityBill extends Model
{
    protected $fillable = ['room_id', 'kind', 'period_month', 'due_on', 'amount', 'account_reference', 'delivered_on', 'notes', 'file_path', 'file_name', 'created_by'];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return ['period_month' => 'date:Y-m-d', 'due_on' => 'date:Y-m-d', 'delivered_on' => 'date:Y-m-d', 'amount' => 'decimal:2'];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class)->with('building:id,name');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(UtilityBillPayment::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(UtilityBillRefund::class)->with('approver', 'voider')->orderBy('id');
    }
}
