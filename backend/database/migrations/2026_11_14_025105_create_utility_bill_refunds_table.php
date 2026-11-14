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
        Schema::create('utility_bill_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utility_bill_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 10, 2);
            $table->date('refunded_on');
            $table->string('method');
            $table->string('reference')->nullable();
            $table->text('reason');
            $table->foreignId('approved_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('void_reason')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('utility_bill_refunds');
    }
};
