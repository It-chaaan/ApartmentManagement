<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $fillable = ['full_name', 'phone', 'email', 'contact_address', 'emergency_name', 'emergency_phone', 'emergency_relationship'];

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }
}
