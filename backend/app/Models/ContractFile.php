<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractFile extends Model
{
    protected $fillable = ['path', 'original_name', 'uploaded_by'];

    public function contract(): BelongsTo { return $this->belongsTo(Contract::class); }
}
