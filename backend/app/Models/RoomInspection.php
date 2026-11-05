<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomInspection extends Model
{
    protected $fillable = ['room_id', 'contract_id', 'inspected_by', 'type', 'inspected_on', 'notes'];

    protected function casts(): array { return ['inspected_on' => 'date:Y-m-d']; }
    public function items(): HasMany { return $this->hasMany(InspectionItem::class); }
    public function photos(): HasMany { return $this->hasMany(InspectionPhoto::class, 'room_inspection_id'); }
    public function inspector(): BelongsTo { return $this->belongsTo(User::class, 'inspected_by')->select('id', 'name'); }
    public function room(): BelongsTo { return $this->belongsTo(Room::class); }
}
