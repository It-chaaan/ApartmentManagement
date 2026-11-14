<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UtilityMeterChargeTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_reviews_calculated_charge_before_bill_and_corrections_keep_history(): void
    {
        Storage::fake('local');
        $this->seed();
        $staff = User::create(['name' => 'Staff', 'email' => 'meter-staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $this->actingAs($staff);
        $room = Room::firstOrFail();
        $reading = $this->reading($room->id);

        $charge = $this->postJson('/api/utility-meter-charges', $reading)->assertCreated()
            ->assertJsonPath('status', 'draft')->assertJsonPath('units_used', '1.005')
            ->assertJsonPath('amount', '1.01')->json();
        $this->getJson('/api/utility-bills')->assertJsonCount(0);
        $this->postJson('/api/utility-meter-charges', $reading)->assertUnprocessable();

        $this->postJson("/api/utility-meter-charges/{$charge['id']}/approve")->assertOk()
            ->assertJsonPath('status', 'posted')->assertJsonPath('approved_by', 'Staff');
        $this->getJson('/api/utility-bills')->assertJsonCount(1)->assertJsonPath('0.amount', '1.01');
        $this->postJson("/api/utility-meter-charges/{$charge['id']}/approve")->assertUnprocessable();

        $revised = [...$reading, 'current_reading' => '2.005', 'reason' => 'Initial reading was transcribed incorrectly'];
        $this->putJson("/api/utility-meter-charges/{$charge['id']}", $revised)->assertOk()
            ->assertJsonPath('status', 'revision')->assertJsonPath('amount', '2.01')->assertJsonPath('history.0.previous.amount', '1.01')
            ->assertJsonPath('history.0.corrected_by.name', 'Staff')
            ->assertJsonPath('history.0.reason', 'Initial reading was transcribed incorrectly');
        $this->getJson('/api/utility-bills')->assertJsonPath('0.amount', '1.01');
        $this->postJson("/api/utility-meter-charges/{$charge['id']}/approve")->assertOk()->assertJsonPath('status', 'posted');
        $this->getJson('/api/utility-bills')->assertJsonPath('0.amount', '2.01');
        $billId = $this->getJson('/api/utility-bills')->json('0.id');
        $pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF";
        $this->postJson("/api/utility-bills/$billId/file", ['file' => UploadedFile::fake()->createWithContent('original.pdf', $pdf)])->assertOk();
        $this->postJson("/api/utility-bills/$billId/payments", [
            'submission_key' => 'c6726e3a-bfbf-437a-918a-9f248d4ac27e', 'paid_on' => '2026-03-01',
            'amount' => '5.00', 'method' => 'cash',
        ])->assertOk();
        $refundId = $this->postJson("/api/utility-bills/$billId/refunds", [
            'amount' => '2.00', 'refunded_on' => '2026-03-02', 'method' => 'cash', 'reason' => 'Returned overpayment',
        ])->assertCreated()->json('id');
        $this->putJson("/api/utility-meter-charges/{$charge['id']}", [
            ...$reading, 'current_reading' => '4.005', 'reason' => 'Second reading correction',
        ])->assertOk()->assertJsonPath('status', 'revision');
        $this->postJson("/api/utility-meter-charges/{$charge['id']}/approve")->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->getJson('/api/utility-bills')->assertJsonPath('0.amount', '2.01');
        $this->postJson("/api/utility-bills/$billId/refunds/$refundId/void", ['reason' => 'Refund amount was entered incorrectly'])->assertOk();
        $this->postJson("/api/utility-meter-charges/{$charge['id']}/approve")->assertOk()->assertJsonPath('status', 'posted');
        $this->getJson('/api/utility-bills')->assertJsonPath('0.amount', '4.01')->assertJsonPath('0.file_needs_review', true);
        $this->get("/api/utility-bills/$billId/file", ['Accept' => 'application/json'])->assertStatus(409);
        $this->postJson("/api/utility-bills/$billId/file", ['file' => UploadedFile::fake()->createWithContent('revised.pdf', $pdf)])->assertOk()
            ->assertJsonPath('file_needs_review', false);
        $this->get("/api/utility-bills/$billId/file")->assertOk();
        $this->assertStringNotContainsString('Initial reading was transcribed incorrectly', json_encode($this->getJson('/api/public/site')->assertOk()->json()));

        auth()->logout();
        $this->getJson('/api/utility-meter-charges')->assertUnauthorized();
        $this->postJson('/api/utility-meter-charges', $reading)->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Viewer', 'email' => 'meter-viewer@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']));
        $this->getJson('/api/utility-meter-charges')->assertForbidden();
        $this->postJson('/api/utility-meter-charges', $reading)->assertForbidden();
    }

    public function test_missing_or_inconsistent_readings_cannot_post_and_manual_bills_still_work(): void
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Owner', 'email' => 'meter-owner@example.test', 'password' => 'long-secret-password', 'role' => 'owner']));
        $room = Room::firstOrFail();
        $reading = $this->reading($room->id);
        $this->postJson('/api/utility-meter-charges', [...$reading, 'current_reading' => null])->assertUnprocessable();
        $this->postJson('/api/utility-meter-charges', [...$reading, 'current_reading' => '-1'])->assertUnprocessable();
        $this->postJson('/api/utility-meter-charges', [...$reading, 'period_month' => '2026-03'])->assertUnprocessable();

        $first = $this->postJson('/api/utility-meter-charges', $reading)->assertCreated()->json('id');
        $this->postJson("/api/utility-meter-charges/$first/approve")->assertOk();
        $next = [...$reading, 'period_month' => '2026-03', 'previous_read_on' => '2026-02-28',
            'current_read_on' => '2026-03-31', 'due_on' => '2026-04-10', 'previous_reading' => '1.000', 'current_reading' => '3.000'];
        $this->postJson('/api/utility-meter-charges', $next)->assertUnprocessable()->assertJsonValidationErrors('previous_reading');
        $next['previous_reading'] = '1.005';
        $second = $this->postJson('/api/utility-meter-charges', $next)->assertCreated()->json('id');
        $this->postJson("/api/utility-meter-charges/$second/approve")->assertOk();
        $this->putJson("/api/utility-meter-charges/$first", [...$reading, 'current_reading' => '2.000', 'reason' => 'Late correction'])
            ->assertUnprocessable()->assertJsonValidationErrors('period_month');

        $this->postJson('/api/utility-bills', [
            'room_id' => $room->id, 'kind' => 'water', 'period_month' => '2026-02',
            'due_on' => '2026-03-10', 'amount' => '80.00',
        ])->assertCreated();
        $this->postJson('/api/utility-meter-charges', [...$reading, 'kind' => 'water'])->assertUnprocessable();

        $otherRoom = Room::where('id', '!=', $room->id)->firstOrFail();
        $draft = $this->postJson('/api/utility-meter-charges', [
            ...$reading, 'kind' => 'water', 'period_month' => '2026-04', 'previous_read_on' => '2026-03-31',
            'current_read_on' => '2026-04-30', 'due_on' => '2026-05-10',
        ])->assertCreated()->json('id');
        $this->putJson("/api/utility-meter-charges/$draft", [
            ...$reading, 'room_id' => $otherRoom->id, 'kind' => 'water', 'period_month' => '2026-05',
            'previous_read_on' => '2026-04-30', 'current_read_on' => '2026-05-31',
            'due_on' => '2026-06-10', 'reason' => 'Wrong room and utility selected',
        ])->assertOk()->assertJsonPath('room_id', $otherRoom->id)->assertJsonPath('kind', 'water')
            ->assertJsonPath('history.0.previous.room_id', $room->id);
        $zero = $this->postJson('/api/utility-meter-charges', [
            ...$reading, 'kind' => 'water', 'period_month' => '2026-06',
            'previous_read_on' => '2026-05-31', 'current_read_on' => '2026-06-30',
            'due_on' => '2026-07-10', 'previous_reading' => '10.000', 'current_reading' => '10.000',
        ])->assertCreated()->assertJsonPath('amount', '0.00')->json('id');
        $this->postJson("/api/utility-meter-charges/$zero/approve")->assertOk();
        $this->assertSame('no_charge', collect($this->getJson('/api/utility-bills')->json())->firstWhere('period_month', '2026-06')['status']);
    }

    private function reading(int $roomId): array
    {
        return [
            'room_id' => $roomId, 'kind' => 'electricity', 'period_month' => '2026-02',
            'previous_read_on' => '2026-01-31', 'current_read_on' => '2026-02-28',
            'previous_reading' => '0.000', 'current_reading' => '1.005',
            'rate_per_unit' => '1.0000', 'due_on' => '2026-03-10',
        ];
    }
}
