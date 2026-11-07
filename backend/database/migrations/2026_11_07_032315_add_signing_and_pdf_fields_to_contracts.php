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
        Schema::table('contracts', function (Blueprint $table) {
            $table->timestamp('signing_recorded_at')->nullable();
            $table->foreignId('signing_recorded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->json('pdf_fields')->nullable();
        });
        Schema::table('contract_files', function (Blueprint $table) {
            $table->string('kind')->default('signed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('signing_recorded_by');
            $table->dropColumn(['signing_recorded_at', 'pdf_fields']);
        });
        Schema::table('contract_files', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
