<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomPhoto extends Model
{
    protected $attributes = ['is_public' => false];

    protected $fillable = ['room_id', 'path', 'original_name', 'is_public', 'approved_by', 'approved_at'];

    protected $appends = ['url'];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return ['is_public' => 'boolean', 'approved_at' => 'datetime'];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function getUrlAttribute(): string
    {
        return '/api/photos/'.$this->id;
    }
}
