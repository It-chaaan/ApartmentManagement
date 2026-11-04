<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('contact_address')->nullable();
            $table->string('emergency_name')->nullable();
            $table->string('emergency_phone')->nullable();
            $table->string('emergency_relationship')->nullable();
            $table->timestamps();
        });
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->restrictOnDelete();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->foreignId('previous_contract_id')->nullable()->unique()->constrained('contracts')->restrictOnDelete();
            $table->unsignedBigInteger('active_room_id')->nullable()->unique();
            $table->date('signed_on');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->decimal('monthly_rent', 10, 2);
            $table->unsignedTinyInteger('due_day');
            $table->decimal('advance_amount', 10, 2);
            $table->decimal('deposit_amount', 10, 2);
            $table->decimal('advance_paid', 10, 2)->nullable();
            $table->decimal('deposit_paid', 10, 2)->nullable();
            $table->date('moved_in_on')->nullable();
            $table->date('ended_on')->nullable();
            $table->text('end_review_note')->nullable();
            $table->string('status')->default('draft');
            $table->timestamps();
        });
        Schema::create('contract_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->restrictOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_files');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('tenants');
    }
};
