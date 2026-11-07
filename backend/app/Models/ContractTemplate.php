<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractTemplate extends Model
{
    protected $fillable = ['path', 'original_name', 'uploaded_by'];
}
