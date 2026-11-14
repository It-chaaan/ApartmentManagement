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
        Schema::create('utility_meter_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->string('kind');
            $table->date('period_month');
            $table->date('previous_read_on');
            $table->date('current_read_on');
            $table->decimal('previous_reading', 10, 3);
            $table->decimal('current_reading', 10, 3);
            $table->decimal('units_used', 10, 3);
            $table->decimal('rate_per_unit', 8, 4);
            $table->decimal('amount', 10, 2);
            $table->date('due_on');
            $table->json('history')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('utility_bill_id')->nullable()->unique()->constrained('utility_bills')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['room_id', 'kind', 'period_month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('utility_meter_charges');
    }
};
