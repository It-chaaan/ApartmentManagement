<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    protected $fillable = ['building_id', 'code', 'floor', 'side', 'size_min_sqm', 'size_max_sqm', 'monthly_rent', 'amenities', 'description', 'status'];

    protected function casts(): array
    {
        return ['floor' => 'integer', 'size_min_sqm' => 'decimal:2', 'size_max_sqm' => 'decimal:2', 'monthly_rent' => 'decimal:2', 'amenities' => 'array'];
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(RoomPhoto::class);
    }
}
