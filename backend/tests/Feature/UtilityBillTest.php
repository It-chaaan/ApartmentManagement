<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class UtilityBillTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_records_and_partially_pays_a_room_bill(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $room = Room::firstOrFail();
        $bill = $this->postJson('/api/utility-bills', [
            'room_id' => $room->id, 'kind' => 'electricity', 'period_month' => '2026-11',
            'due_on' => '2026-11-20', 'amount' => '1250.00', 'delivered_on' => '2026-11-05',
        ])->assertCreated()->assertJsonPath('balance', '1250.00')->json();

        $payload = ['submission_key' => (string) Str::uuid(), 'paid_on' => '2026-11-10', 'amount' => '500.00', 'method' => 'cash'];
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', $payload)->assertOk()->assertJsonPath('balance', '750.00')->assertJsonPath('status', 'partial');
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', $payload)->assertOk()->assertJsonCount(1, 'payments');
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', [...$payload, 'submission_key' => (string) Str::uuid(), 'amount' => '800.00'])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertDatabaseCount('utility_bill_payments', 1);
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', [...$payload, 'submission_key' => (string) Str::uuid(), 'amount' => '750.00'])->assertOk()->assertJsonPath('balance', '0.00')->assertJsonPath('status', 'paid');
        $this->assertDatabaseCount('utility_bill_payments', 2);
        $this->postJson('/api/utility-bills', [
            'room_id' => $room->id, 'kind' => 'electricity', 'period_month' => '2026-11', 'due_on' => '2026-11-20', 'amount' => '1250.00',
        ])->assertUnprocessable()->assertJsonValidationErrors('period_month');
    }

    public function test_bill_pdf_is_private_and_requires_a_staff_session(): void
    {
        Storage::fake('local');
        $this->seed();
        $room = Room::firstOrFail();
        $this->getJson('/api/utility-bills')->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $bill = $this->postJson('/api/utility-bills', [
            'room_id' => $room->id, 'kind' => 'water', 'period_month' => '2026-11', 'due_on' => '2026-11-20', 'amount' => '300.00',
        ])->assertCreated()->json();
        $this->post('/api/utility-bills/'.$bill['id'].'/file', ['file' => UploadedFile::fake()->create('water.pdf', 20, 'application/pdf')])->assertOk()->assertJsonPath('file_name', 'water.pdf')->assertJsonMissingPath('file_path');
        $this->get('/api/utility-bills/'.$bill['id'].'/file')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        auth()->logout();
        $this->getJson('/api/utility-bills/'.$bill['id'].'/file')->assertUnauthorized();
    }

    public function test_non_staff_cannot_read_or_create_bills(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']));
        $this->getJson('/api/utility-bills')->assertForbidden();
        $this->postJson('/api/utility-bills', ['room_id' => Room::firstOrFail()->id])->assertForbidden();
    }
}
