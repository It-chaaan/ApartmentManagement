<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InspectionItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['area', 'condition', 'notes'];
}
