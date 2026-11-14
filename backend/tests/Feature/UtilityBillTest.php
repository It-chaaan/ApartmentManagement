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

    public function test_voided_utility_payment_reopens_balance_and_keeps_audit_details(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $bill = $this->postJson('/api/utility-bills', [
            'room_id' => Room::firstOrFail()->id, 'kind' => 'water', 'period_month' => '2026-11',
            'due_on' => '2026-11-20', 'amount' => '300.00',
        ])->assertCreated()->json();
        $payload = ['submission_key' => (string) Str::uuid(), 'paid_on' => '2026-11-10', 'amount' => '300.00', 'method' => 'cash'];
        $paid = $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', $payload)->assertOk()->assertJsonPath('status', 'paid')->json();
        $url = '/api/utility-bills/'.$bill['id'].'/payments/'.$paid['payments'][0]['id'].'/void';
        $this->postJson($url, ['reason' => 'Duplicate receipt'])->assertOk()
            ->assertJsonPath('balance', '300.00')->assertJsonPath('payments.0.voider.name', 'Staff')
            ->assertJsonPath('payments.0.void_reason', 'Duplicate receipt');
        $this->postJson($url, ['reason' => 'Again'])->assertUnprocessable();
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', $payload)->assertUnprocessable()->assertJsonValidationErrors('submission_key');
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', [...$payload, 'submission_key' => (string) Str::uuid()])->assertOk()->assertJsonPath('balance', '0.00');
    }

    public function test_staff_refunds_only_actual_utility_overpayment(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $bill = $this->postJson('/api/utility-bills', [
            'room_id' => Room::firstOrFail()->id, 'kind' => 'water', 'period_month' => '2026-11',
            'due_on' => '2026-11-20', 'amount' => '300.00',
        ])->assertCreated()->json();
        $paid = $this->postJson('/api/utility-bills/'.$bill['id'].'/payments', [
            'submission_key' => (string) Str::uuid(), 'paid_on' => '2026-11-10', 'amount' => '500.00', 'method' => 'cash',
        ])->assertOk()->assertJsonPath('credit_available', '200.00')->assertJsonPath('status', 'overpaid')->json();
        $refundUrl = '/api/utility-bills/'.$bill['id'].'/refunds';
        $refund = ['amount' => '200.00', 'refunded_on' => '2026-11-11', 'method' => 'cash', 'reason' => 'Bill overpaid'];
        $this->postJson($refundUrl, [...$refund, 'amount' => '201.00'])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->postJson($refundUrl, $refund)->assertCreated()->assertJsonPath('approver.name', 'Staff');
        $this->getJson('/api/utility-bills')->assertJsonPath('0.credit_available', '0.00')->assertJsonPath('0.refunded_amount', '200.00');
        $this->postJson('/api/utility-bills/'.$bill['id'].'/payments/'.$paid['payments'][0]['id'].'/void', ['reason' => 'Incorrect'])->assertUnprocessable();
        auth()->logout();
        $this->postJson($refundUrl, $refund)->assertUnauthorized();
    }

    public function test_non_staff_cannot_read_or_create_bills(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']));
        $this->getJson('/api/utility-bills')->assertForbidden();
        $this->postJson('/api/utility-bills', ['room_id' => Room::firstOrFail()->id])->assertForbidden();
    }
}
