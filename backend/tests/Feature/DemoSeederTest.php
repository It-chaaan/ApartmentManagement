<?php

namespace Tests\Feature;

use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seeder_rejects_the_normal_test_database(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('isolated demo SQLite');
        $this->seed(DemoSeeder::class);
    }
}
