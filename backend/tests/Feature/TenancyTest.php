<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TenancyTest extends TestCase
{
    use RefreshDatabase;

    private function staff(): void
    {
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
    }

    private function tenant(string $name = 'Very Long Tenant Name for Private Records'): int
    {
        return $this->postJson('/api/tenants', ['full_name' => $name, 'phone' => '09170000000', 'emergency_name' => 'Emergency Person', 'emergency_phone' => '09171111111'])->assertCreated()->json('id');
    }

    private function draft(int $tenant, int $room, ?int $previous = null): int
    {
        return $this->postJson('/api/contracts', [
            'tenant_id' => $tenant, 'room_id' => $room, 'previous_contract_id' => $previous,
            'signed_on' => '2026-11-04', 'starts_on' => '2026-11-05', 'ends_on' => '2027-11-05',
            'monthly_rent' => '5000.00', 'due_day' => 5, 'advance_amount' => '5000.00', 'deposit_amount' => '5000.00',
        ])->assertCreated()->json('id');
    }

    public function test_private_tenant_and_contract_routes_and_public_payload(): void
    {
        $this->seed();
        foreach (['/api/tenants', '/api/contracts', '/api/contracts/1/files/1'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->postJson('/api/tenants', ['full_name' => 'Private'])->assertUnauthorized();
        $viewer = User::create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']);
        $this->actingAs($viewer);
        $this->getJson('/api/tenants')->assertForbidden();
        $this->getJson('/api/contracts')->assertForbidden();
        auth()->logout();
        $this->staff();
        $tenant = $this->tenant();
        $this->draft($tenant, Room::firstOrFail()->id);
        $this->assertStringNotContainsString('Very Long Tenant Name', json_encode($this->getJson('/api/public/site')->assertOk()->json()));
        $this->getJson('/api/tenants')->assertOk()->assertJsonFragment(['full_name' => 'Very Long Tenant Name for Private Records']);
    }

    public function test_move_in_prevents_duplicate_room_and_end_requires_review(): void
    {
        $this->seed(); $this->staff();
        $room = Room::firstOrFail();
        $first = $this->draft($this->tenant(), $room->id);
        $second = $this->draft($this->tenant('Other Tenant'), $room->id);
        $this->postJson("/api/contracts/$first/move-in", ['moved_in_on' => '2026-11-05', 'advance_paid' => '5000', 'deposit_paid' => '5000'])->assertUnprocessable();
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'available'])->assertOk();
        $this->postJson("/api/contracts/$first/move-in", ['moved_in_on' => '2026-11-05', 'advance_paid' => '5000', 'deposit_paid' => '5000'])->assertOk()->assertJsonPath('status', 'active');
        $this->assertSame('occupied', $room->fresh()->status);
        $this->assertSame('5000.00', Contract::findOrFail($first)->advance_paid);
        $this->assertSame('5000.00', Contract::findOrFail($first)->deposit_paid);
        $this->postJson("/api/contracts/$second/move-in", ['moved_in_on' => '2026-11-05', 'advance_paid' => '0', 'deposit_paid' => '0'])->assertUnprocessable();
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'available'])->assertUnprocessable();
        $this->postJson("/api/contracts/$first/end", ['ended_on' => '2027-11-05'])->assertUnprocessable();
        $this->postJson("/api/contracts/$first/end", ['ended_on' => '2027-11-05', 'end_review_note' => 'Staff reviewed departure.'])->assertOk();
        $this->assertSame('unverified', $room->fresh()->status);
        $this->assertSame('ended', Contract::findOrFail($first)->status);
        $this->assertSame(2, Contract::where('room_id', $room->id)->count());
        $this->postJson("/api/contracts/$second/move-in", ['moved_in_on' => '2027-11-06', 'advance_paid' => '5000', 'deposit_paid' => '5000'])->assertUnprocessable();
    }

    public function test_renewal_keeps_prior_contract_and_file_versions(): void
    {
        $this->seed(); $this->staff(); Storage::fake('local');
        $room = Room::firstOrFail(); $tenant = $this->tenant(); $first = $this->draft($tenant, $room->id);
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'available'])->assertOk();
        $payment = ['moved_in_on' => '2026-11-05', 'advance_paid' => '5000', 'deposit_paid' => '5000'];
        $this->postJson("/api/contracts/$first/move-in", $payment)->assertOk();
        $renewal = $this->draft($tenant, $room->id, $first);
        $this->postJson('/api/contracts', ['tenant_id' => $tenant, 'room_id' => $room->id, 'previous_contract_id' => $first])->assertUnprocessable();
        $this->postJson("/api/contracts/$renewal/move-in", $payment)->assertOk();
        $this->assertSame('renewed', Contract::findOrFail($first)->status);
        $this->assertSame('active', Contract::findOrFail($renewal)->status);
        $this->assertSame($room->id, Contract::findOrFail($renewal)->active_room_id);
        $this->assertSame('occupied', $room->fresh()->status);
        $pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF";
        $this->postJson("/api/contracts/$first/files", ['file' => UploadedFile::fake()->createWithContent('signed.pdf', $pdf)])->assertCreated();
        $this->postJson("/api/contracts/$first/files", ['file' => UploadedFile::fake()->createWithContent('revised.pdf', $pdf)])->assertCreated();
        $files = Contract::findOrFail($first)->files;
        $this->assertCount(2, $files);
        $this->get("/api/contracts/$first/files/{$files[0]->id}")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->get("/api/contracts/$renewal/files/{$files[0]->id}")->assertNotFound();
        $this->postJson("/api/contracts/$first/files", ['file' => UploadedFile::fake()->create('bad.txt', 1, 'text/plain')])->assertUnprocessable();
        $this->postJson("/api/contracts/$first/files", ['file' => UploadedFile::fake()->create('large.pdf', 11000, 'application/pdf')])->assertUnprocessable();
        auth()->logout();
        $this->get("/api/contracts/$first/files/{$files[0]->id}", ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_contract_and_tenant_validation_failures(): void
    {
        $this->seed(); $this->staff();
        $this->postJson('/api/tenants', ['full_name' => ''])->assertUnprocessable();
        $tenant = $this->tenant(); $room = Room::firstOrFail();
        $this->postJson('/api/contracts', ['tenant_id' => $tenant, 'room_id' => $room->id, 'signed_on' => '2026-11-04', 'starts_on' => '2027-11-05', 'ends_on' => '2026-11-05', 'monthly_rent' => -1, 'due_day' => 32, 'advance_amount' => -1, 'deposit_amount' => -1])->assertUnprocessable();
    }
}
