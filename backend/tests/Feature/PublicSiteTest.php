<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_site_exposes_only_website_fields_and_verified_availability(): void
    {
        $this->seed();
        $room = Room::where('code', '1-A')->firstOrFail();
        $payload = $this->getJson('/api/public/site')->assertOk()->json();
        $this->assertCount(2, $payload['buildings']);
        $this->assertSame(12, $payload['buildings'][0]['room_count']);
        $this->assertSame(6, $payload['buildings'][1]['room_count']);
        $this->assertSame('200.00', $payload['buildings'][0]['lot_area_sqm']);
        $this->assertSame('100.00', $payload['buildings'][1]['lot_area_sqm']);
        $this->assertSame('ask', $this->publicRoom($payload, '1-A')['availability']);
        $this->assertSame('24.00', $this->publicRoom($payload, '1-A')['size_min_sqm']);
        $this->assertSame('25.00', $this->publicRoom($payload, '1-A')['size_max_sqm']);
        $this->assertSame('5000.00', $this->publicRoom($payload, '1-A')['monthly_rent']);
        $this->assertSame('18.00', $payload['buildings'][1]['rooms'][0]['size_min_sqm']);
        $this->assertSame('4000.00', $payload['buildings'][1]['rooms'][0]['monthly_rent']);
        $encoded = json_encode($payload);
        foreach (['email', 'role', 'status', 'path', 'original_name', 'approved_by', 'is_public'] as $privateField) {
            $this->assertStringNotContainsString('"'.$privateField.'"', $encoded);
        }

        foreach (['reserved', 'occupied', 'maintenance', 'unverified'] as $status) {
            $room->update(['status' => $status]);
            $this->assertSame('ask', $this->publicRoom($this->getJson('/api/public/site')->json(), '1-A')['availability']);
        }
        $room->update(['status' => 'available']);
        $this->assertSame('available', $this->publicRoom($this->getJson('/api/public/site')->json(), '1-A')['availability']);
        $this->getJson('/api/rooms')->assertUnauthorized();
        $this->getJson('/api/buildings')->assertUnauthorized();
    }

    public function test_uploaded_photo_stays_private_until_staff_approves_and_can_be_revoked(): void
    {
        $this->seed();
        Storage::fake('local');
        $room = Room::firstOrFail();
        $user = User::create(['name' => 'Family Staff', 'email' => 'staff@example.test', 'password' => 'very-long-secret-password', 'role' => 'staff']);
        $this->actingAs($user);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7Vf8AAAAASUVORK5CYII=');
        $this->postJson('/api/rooms/'.$room->id.'/photos', ['photo' => UploadedFile::fake()->createWithContent('room.png', $png)])->assertCreated()->assertJsonPath('is_public', false);
        $photo = $room->photos()->firstOrFail();
        $this->assertSame([], $this->publicRoom($this->getJson('/api/public/site')->json(), $room->code)['photos']);
        $this->get('/api/public/photos/'.$photo->id)->assertNotFound();
        $this->get('/api/photos/'.$photo->id)->assertOk();

        $this->patchJson('/api/photos/'.$photo->id.'/visibility', ['is_public' => true])->assertOk()->assertJsonPath('is_public', true);
        $this->assertCount(1, $this->publicRoom($this->getJson('/api/public/site')->json(), $room->code)['photos']);
        $this->get('/api/public/photos/'.$photo->id)->assertOk();
        $this->patchJson('/api/photos/'.$photo->id.'/visibility', ['is_public' => false])->assertOk();
        $this->get('/api/public/photos/'.$photo->id)->assertNotFound();

        auth()->logout();
        $this->patchJson('/api/photos/'.$photo->id.'/visibility', ['is_public' => true])->assertUnauthorized();
        $this->get('/api/photos/'.$photo->id, ['Accept' => 'application/json'])->assertUnauthorized();
    }

    private function publicRoom(array $payload, string $code): array
    {
        foreach ($payload['buildings'][0]['rooms'] as $room) {
            if ($room['code'] === $code) {
                return $room;
            }
        }
        $this->fail('Room missing from public response.');
    }
}
