<?php

namespace App\Models;

use Database\Factories\UtilityEmailImportFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityEmailImport extends Model
{
    /** @use HasFactory<UtilityEmailImportFactory> */
    use HasFactory;

    protected $fillable = ['room_id', 'kind', 'period_month', 'due_on', 'amount', 'sender_address', 'message_id', 'received_on', 'account_reference', 'notes', 'file_path', 'file_name', 'file_sha256', 'status', 'exception_reason', 'review_reason', 'imported_by', 'reviewed_by', 'reviewed_at', 'utility_bill_id'];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return ['period_month' => 'date:Y-m-d', 'due_on' => 'date:Y-m-d', 'received_on' => 'date:Y-m-d', 'amount' => 'decimal:2', 'reviewed_at' => 'datetime'];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class)->with('building:id,name');
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by')->select('id', 'name');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by')->select('id', 'name');
    }
}
