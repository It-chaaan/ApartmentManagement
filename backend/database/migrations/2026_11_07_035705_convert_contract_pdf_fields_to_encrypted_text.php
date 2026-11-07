<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->text('pdf_fields')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::table('contracts')->whereNotNull('pdf_fields')->exists()) {
            throw new RuntimeException('Cannot roll back encrypted contract fields while saved values exist.');
        }
        Schema::table('contracts', function (Blueprint $table) {
            $table->json('pdf_fields')->nullable()->change();
        });
    }
};
