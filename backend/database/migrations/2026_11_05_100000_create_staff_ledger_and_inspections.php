<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contract_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->restrictOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('kind');
            $table->date('period_month')->nullable();
            $table->date('paid_on');
            $table->decimal('amount', 10, 2);
            $table->string('method');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('submission_key')->unique();
            $table->timestamps();
            $table->index(['contract_id', 'kind', 'period_month']);
        });

        Schema::create('room_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('inspected_by')->constrained('users')->restrictOnDelete();
            $table->string('type');
            $table->date('inspected_on');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['room_id', 'inspected_on']);
        });

        Schema::create('inspection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_inspection_id')->constrained()->cascadeOnDelete();
            $table->string('area');
            $table->string('condition');
            $table->text('notes')->nullable();
            $table->unique(['room_inspection_id', 'area']);
        });

        Schema::create('inspection_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_inspection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->timestamps();
        });

        // Existing signing amounts become distinct ledger entries without changing their meaning.
        DB::table('contracts')->whereNotNull('moved_in_on')->orderBy('id')->chunkById(100, function ($contracts) {
            foreach ($contracts as $contract) {
                foreach (['advance' => 'advance_paid', 'deposit' => 'deposit_paid'] as $kind => $column) {
                    if ($contract->$column === null || (float) $contract->$column <= 0) {
                        continue;
                    }
                    DB::table('contract_payments')->insert([
                        'contract_id' => $contract->id, 'recorded_by' => null, 'kind' => $kind,
                        'period_month' => null, 'paid_on' => $contract->moved_in_on,
                        'amount' => $contract->$column, 'method' => 'not_recorded',
                        'notes' => 'Migrated from the original move-in amount; payment method was not recorded.',
                        'submission_key' => (string) \Illuminate\Support\Str::uuid(),
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_photos');
        Schema::dropIfExists('inspection_items');
        Schema::dropIfExists('room_inspections');
        Schema::dropIfExists('contract_payments');
    }
};
