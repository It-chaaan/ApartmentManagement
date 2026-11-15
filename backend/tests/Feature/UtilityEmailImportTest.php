<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Models\UtilityBill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UtilityEmailImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_sample_import_is_private_and_requires_review_before_creating_bill(): void
    {
        Storage::fake('local');
        $this->seed();
        $staff = User::create(['name' => 'Staff', 'email' => 'importer@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $payload = $this->payload(Room::firstOrFail()->id);
        $this->postJson('/api/utility-email-imports', $payload)->assertUnauthorized();
        $this->actingAs($staff);
        $import = $this->postJson('/api/utility-email-imports', $payload)->assertCreated()
            ->assertJsonPath('status', 'pending')->json();
        $this->assertSame(0, UtilityBill::count());
        $this->get("/api/utility-email-imports/{$import['id']}/file")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson("/api/utility-email-imports/{$import['id']}/approve")->assertOk()
            ->assertJsonPath('status', 'approved')->assertJsonPath('reviewed_by', 'Staff');
        $bill = UtilityBill::firstOrFail();
        $this->assertSame('187.50', $bill->amount);
        $this->get("/api/utility-bills/{$bill->id}/file")->assertOk();
        $this->postJson("/api/utility-bills/{$bill->id}/file", ['file' => UploadedFile::fake()->createWithContent('replacement.pdf', "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF")])->assertOk();
        $this->get("/api/utility-email-imports/{$import['id']}/file")->assertOk();
        $this->postJson("/api/utility-email-imports/{$import['id']}/approve")->assertUnprocessable();
        $this->assertSame(1, UtilityBill::count());
        $this->assertStringNotContainsString('sample-provider@example.test', json_encode($this->getJson('/api/public/site')->json()));
        auth()->logout();
        $this->getJson('/api/utility-email-imports')->assertUnauthorized();
        $this->get("/api/utility-email-imports/{$import['id']}/file", ['Accept' => 'application/json'])->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Viewer', 'email' => 'viewer-import@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']));
        $this->getJson('/api/utility-email-imports')->assertForbidden();
    }

    public function test_duplicate_or_existing_bill_is_exception_and_cannot_post(): void
    {
        Storage::fake('local');
        $this->seed();
        $this->actingAs(User::create(['name' => 'Owner', 'email' => 'owner-import@example.test', 'password' => 'long-secret-password', 'role' => 'owner']));
        $roomId = Room::firstOrFail()->id;
        $first = $this->postJson('/api/utility-email-imports', $this->payload($roomId))->assertCreated()->json('id');
        $duplicate = $this->postJson('/api/utility-email-imports', $this->payload($roomId))->assertCreated()
            ->assertJsonPath('status', 'exception')->json('id');
        $this->postJson("/api/utility-email-imports/$duplicate/approve")->assertUnprocessable();
        $this->postJson("/api/utility-email-imports/$duplicate/reject", ['reason' => 'Repeated provider message'])->assertOk()
            ->assertJsonPath('status', 'rejected')->assertJsonPath('review_reason', 'Repeated provider message');
        $this->postJson("/api/utility-email-imports/$first/approve")->assertOk();
        $this->assertSame(1, UtilityBill::count());
        $later = $this->postJson('/api/utility-email-imports', $this->payload($roomId))->assertCreated()->assertJsonPath('status', 'exception');
        $this->assertSame(1, UtilityBill::count());
        $this->assertNotNull($later->json('exception_reason'));
    }

    public function test_manual_bill_added_after_import_blocks_late_approval(): void
    {
        Storage::fake('local');
        $this->seed();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'late-bill@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $roomId = Room::firstOrFail()->id;
        $id = $this->postJson('/api/utility-email-imports', $this->payload($roomId))->assertCreated()->json('id');
        $this->postJson('/api/utility-bills', ['room_id' => $roomId, 'kind' => 'water', 'period_month' => '2026-02', 'due_on' => '2026-03-10', 'amount' => '187.50'])->assertCreated();
        $this->postJson("/api/utility-email-imports/$id/approve")->assertStatus(409)->assertJsonPath('status', 'exception');
        $this->assertSame(1, UtilityBill::count());
    }

    private function payload(int $roomId): array
    {
        return [
            'room_id' => $roomId, 'kind' => 'water', 'period_month' => '2026-02',
            'due_on' => '2026-03-10', 'amount' => '187.50',
            'sender_address' => 'sample-provider@example.test', 'message_id' => 'sample-2026-02',
            'received_on' => '2026-03-01',
            'file' => UploadedFile::fake()->createWithContent('sample.pdf', "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
        ];
    }
}
