<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomPhoto extends Model
{
    protected $fillable = ['room_id', 'path', 'original_name'];
    protected $appends = ['url'];
    protected $hidden = ['path'];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function getUrlAttribute(): string
    {
        return '/api/photos/'.$this->id;
    }
}
