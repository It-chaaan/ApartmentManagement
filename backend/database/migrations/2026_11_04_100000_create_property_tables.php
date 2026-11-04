<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('staff');
        });
        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('address');
            $table->decimal('lot_area_sqm', 8, 2);
            $table->text('description')->nullable();
            $table->json('amenities');
            $table->timestamps();
        });
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->unsignedTinyInteger('floor');
            $table->string('side')->nullable();
            $table->decimal('size_min_sqm', 6, 2);
            $table->decimal('size_max_sqm', 6, 2);
            $table->decimal('monthly_rent', 10, 2);
            $table->json('amenities');
            $table->text('description')->nullable();
            $table->string('status')->default('unverified');
            $table->timestamps();
            $table->unique(['building_id', 'code']);
        });
        Schema::create('room_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_photos');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('buildings');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('role'));
    }
};
