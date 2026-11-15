<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\User;
use App\Models\UtilityEmailImport;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UtilityEmailImport>
 */
class UtilityEmailImportFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::firstOrFail()->id,
            'kind' => 'electricity',
            'period_month' => '2026-02-01',
            'due_on' => '2026-03-10',
            'amount' => '100.00',
            'sender_address' => 'sample-provider@example.test',
            'received_on' => '2026-03-01',
            'file_path' => 'utility-email-imports/sample.pdf',
            'file_name' => 'sample.pdf',
            'file_sha256' => hash('sha256', 'sample document'),
            'imported_by' => User::firstOrFail()->id,
        ];
    }
}
