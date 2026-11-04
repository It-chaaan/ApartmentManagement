<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Building extends Model
{
    protected $fillable = ['slug', 'name', 'address', 'lot_area_sqm', 'description', 'amenities'];

    protected function casts(): array
    {
        return ['lot_area_sqm' => 'decimal:2', 'amenities' => 'array'];
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }
}
