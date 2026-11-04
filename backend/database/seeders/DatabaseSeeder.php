<?php

namespace Database\Seeders;

use App\Models\Building;
use App\Models\Room;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $shared = ['Furnished rooms', 'Motorcycle parking', 'Individual water meter', 'Individual electricity meter'];
        $address = 'Brgy. Lingunan, Valenzuela City';
        $one = Building::firstOrCreate(['slug' => 'building-1'], [
            'name' => 'Building 1', 'address' => $address, 'lot_area_sqm' => 200,
            'description' => '12 rooms across two floors. Room sizes are approximately 24–25 sqm.', 'amenities' => $shared,
        ]);
        $two = Building::firstOrCreate(['slug' => 'building-2'], [
            'name' => 'Building 2', 'address' => $address, 'lot_area_sqm' => 100,
            'description' => 'Six rooms across two floors. About half of the first floor is motorcycle parking.', 'amenities' => $shared,
        ]);
        foreach ([1, 2] as $floor) {
            foreach (['right' => ['A', 'B', 'C'], 'left' => ['D', 'E', 'F']] as $side => $letters) {
                foreach ($letters as $letter) {
                    Room::firstOrCreate(['building_id' => $one->id, 'code' => "$floor-$letter"], [
                        'floor' => $floor, 'side' => $side, 'size_min_sqm' => 24, 'size_max_sqm' => 25,
                        'monthly_rent' => 5000, 'amenities' => $shared, 'status' => 'unverified',
                    ]);
                }
            }
        }
        foreach (range(1, 6) as $code) {
            Room::firstOrCreate(['building_id' => $two->id, 'code' => (string) $code], [
                'floor' => $code <= 2 ? 1 : 2, 'side' => null, 'size_min_sqm' => 18, 'size_max_sqm' => 18,
                'monthly_rent' => 4000, 'amenities' => $shared, 'status' => 'unverified',
            ]);
        }
    }
}
