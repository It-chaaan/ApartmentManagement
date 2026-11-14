<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class E2eSeeder extends Seeder
{
    public function run(): void
    {
        $database = str_replace('\\', '/', (string) config('database.connections.sqlite.database'));
        if (! app()->environment('e2e') || config('database.default') !== 'sqlite' || ! str_contains($database, '/storage/framework/testing/e2e-')) {
            throw new RuntimeException('E2E accounts may only be seeded into a disposable SQLite test database.');
        }

        $password = env('E2E_TEST_PASSWORD');
        if (! is_string($password) || strlen($password) < 12) {
            throw new RuntimeException('A temporary E2E_TEST_PASSWORD of at least 12 characters is required.');
        }

        User::create(['name' => 'E2E Owner', 'email' => 'owner@e2e.test', 'password' => $password, 'role' => 'owner', 'is_active' => true]);
        User::create(['name' => 'E2E Staff', 'email' => 'staff@e2e.test', 'password' => $password, 'role' => 'staff', 'is_active' => true]);
    }
}
