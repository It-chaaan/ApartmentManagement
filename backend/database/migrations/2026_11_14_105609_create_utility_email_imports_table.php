<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('utility_email_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->string('kind');
            $table->date('period_month');
            $table->date('due_on');
            $table->decimal('amount', 10, 2);
            $table->string('sender_address');
            $table->string('message_id')->nullable();
            $table->date('received_on');
            $table->string('account_reference')->nullable();
            $table->text('notes')->nullable();
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_sha256', 64);
            $table->string('status')->default('pending');
            $table->text('exception_reason')->nullable();
            $table->text('review_reason')->nullable();
            $table->foreignId('imported_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('utility_bill_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->timestamps();
            $table->index(['room_id', 'kind', 'period_month']);
            $table->index(['sender_address', 'message_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('utility_email_imports');
    }
};
