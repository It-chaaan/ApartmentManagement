<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InspectionPhoto extends Model
{
    public function inspection(): \Illuminate\Database\Eloquent\Relations\BelongsTo { return $this->belongsTo(RoomInspection::class, 'room_inspection_id'); }
    protected $fillable = ['path', 'original_name', 'uploaded_by'];
    protected $hidden = ['path'];
}
