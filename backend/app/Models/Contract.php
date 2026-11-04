<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $fillable = ['tenant_id', 'room_id', 'previous_contract_id', 'active_room_id', 'signed_on', 'starts_on', 'ends_on', 'monthly_rent', 'due_day', 'advance_amount', 'deposit_amount', 'advance_paid', 'deposit_paid', 'moved_in_on', 'ended_on', 'end_review_note', 'status'];

    protected function casts(): array
    {
        return ['signed_on' => 'date:Y-m-d', 'starts_on' => 'date:Y-m-d', 'ends_on' => 'date:Y-m-d', 'moved_in_on' => 'date:Y-m-d', 'ended_on' => 'date:Y-m-d', 'monthly_rent' => 'decimal:2', 'advance_amount' => 'decimal:2', 'deposit_amount' => 'decimal:2', 'advance_paid' => 'decimal:2', 'deposit_paid' => 'decimal:2'];
    }

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function room(): BelongsTo { return $this->belongsTo(Room::class); }
    public function previousContract(): BelongsTo { return $this->belongsTo(self::class, 'previous_contract_id'); }
    public function files(): HasMany { return $this->hasMany(ContractFile::class)->orderBy('id'); }
}
