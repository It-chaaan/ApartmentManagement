<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PropertyManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_confirmed_layout_once_without_resetting_edits(): void
    {
        $this->seed();
        $this->assertSame(2, Building::count());
        $this->assertSame(18, Room::count());
        $one = Building::where('slug', 'building-1')->firstOrFail();
        $two = Building::where('slug', 'building-2')->firstOrFail();
        $this->assertSame('200.00', $one->lot_area_sqm);
        $this->assertSame('100.00', $two->lot_area_sqm);
        $this->assertSame(['1-A', '1-B', '1-C', '1-D', '1-E', '1-F', '2-A', '2-B', '2-C', '2-D', '2-E', '2-F'], $one->rooms()->orderBy('code')->pluck('code')->all());
        $this->assertSame(['1', '2', '3', '4', '5', '6'], $two->rooms()->orderBy('code')->pluck('code')->all());
        $this->assertSame(18, Room::where('status', 'unverified')->count());
        $first = $one->rooms()->where('code', '1-A')->firstOrFail();
        $this->assertSame('right', $first->side);
        $this->assertSame('24.00', $first->size_min_sqm);
        $this->assertSame('25.00', $first->size_max_sqm);
        $this->assertSame('5000.00', $first->monthly_rent);
        $this->assertSame(2, $two->rooms()->where('floor', 1)->count());
        $this->assertSame(4, $two->rooms()->where('floor', 2)->count());
        $this->assertSame('4000.00', $two->rooms()->first()->monthly_rent);
        $first->update(['status' => 'maintenance']);
        $this->seed();
        $this->assertSame(2, Building::count());
        $this->assertSame(18, Room::count());
        $this->assertSame('maintenance', $first->fresh()->status);
    }

    public function test_staff_can_sign_in_edit_and_upload_while_guests_cannot_read_management_data(): void
    {
        $this->seed();
        $this->getJson('/api/buildings')->assertUnauthorized();
        $this->getJson('/api/rooms')->assertUnauthorized();
        $this->postJson('/api/rooms/1/photos')->assertUnauthorized();

        $user = User::create(['name' => 'Family Staff', 'email' => 'staff@example.test', 'password' => 'very-long-secret-password', 'role' => 'staff']);
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'very-long-secret-password'])->assertOk();
        $room = Room::firstOrFail();
        $this->getJson('/api/rooms')->assertOk()->assertJsonCount(18);
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'occupied', 'monthly_rent' => '5100.50'])->assertOk();
        $this->assertSame('5100.50', $room->fresh()->monthly_rent);
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'invalid'])->assertUnprocessable();

        Storage::fake('local');
        $this->postJson('/api/rooms/'.$room->id.'/photos', ['photo' => UploadedFile::fake()->create('note.txt', 1, 'text/plain')])->assertUnprocessable();
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7Vf8AAAAASUVORK5CYII=');
        $this->postJson('/api/rooms/'.$room->id.'/photos', ['photo' => UploadedFile::fake()->createWithContent('room.png', $png)])->assertCreated();
        $photo = $room->photos()->firstOrFail();
        Storage::disk('local')->assertExists($photo->path);
        $this->get('/api/photos/'.$photo->id)->assertOk();
        $this->postJson('/api/logout')->assertOk();
        $this->getJson('/api/rooms')->assertUnauthorized();
        $this->get('/api/photos/'.$photo->id, ['Accept' => 'application/json'])->assertUnauthorized();
    }
}
