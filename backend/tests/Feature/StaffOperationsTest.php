<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class StaffOperationsTest extends TestCase
{
    use RefreshDatabase;

    private function activeContract(): Contract
    {
        $this->seed();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $room = Room::firstOrFail();
        $tenant = $this->postJson('/api/tenants', ['full_name' => 'Private Tenant'])->assertCreated()->json('id');
        $contract = $this->postJson('/api/contracts', [
            'tenant_id' => $tenant, 'room_id' => $room->id, 'signed_on' => '2026-01-01',
            'starts_on' => '2026-01-15', 'ends_on' => '2026-04-15', 'monthly_rent' => '5000',
            'due_day' => 31, 'advance_amount' => '5000', 'deposit_amount' => '5000',
        ])->assertCreated()->json('id');
        $this->putJson('/api/rooms/'.$room->id, ['status' => 'available'])->assertOk();
        $this->postJson("/api/contracts/$contract/sign", ['signed_on' => '2026-01-10', 'received_full_payment' => true, 'method' => 'cash'])->assertOk();
        $this->postJson("/api/contracts/$contract/move-in", ['moved_in_on' => '2026-01-15'])->assertOk();

        return Contract::findOrFail($contract);
    }

    public function test_monthly_balances_keep_advance_and_deposit_separate_and_retries_are_idempotent(): void
    {
        CarbonImmutable::setTestNow('2026-02-28');
        $contract = $this->activeContract();
        $ledger = $this->getJson('/api/staff/ledgers')->assertOk()->json((string) $contract->id);
        $this->assertSame('5000.00', $ledger['due_balance']);
        $this->assertSame('5000.00', $ledger['advance_paid']);
        $this->assertSame('5000.00', $ledger['deposit_paid']);
        $this->assertSame('2026-02-28', $ledger['installments'][1]['due_on']);
        $key = (string) Str::uuid();
        $payment = ['submission_key' => $key, 'kind' => 'rent', 'period_month' => '2026-02',
            'paid_on' => '2026-02-01', 'amount' => '2000', 'method' => 'gcash',
            'reference' => 'REF-1', 'notes' => 'Partial payment'];
        $this->postJson("/api/contracts/$contract->id/payments", $payment)->assertCreated();
        $this->postJson("/api/contracts/$contract->id/payments", $payment)->assertOk();
        $this->assertSame(4, $contract->payments()->count());
        $this->getJson('/api/staff/ledgers')->assertJsonPath($contract->id.'.due_balance', '3000.00');
        $this->postJson("/api/contracts/$contract->id/payments", array_replace($payment, ['submission_key' => (string) Str::uuid(), 'amount' => '4000']))->assertCreated();
        $this->getJson('/api/staff/ledgers')->assertJsonPath($contract->id.'.rent_credit', '1000.00');
        $this->postJson("/api/contracts/$contract->id/payments", array_replace($payment, ['submission_key' => (string) Str::uuid(), 'kind' => 'advance', 'period_month' => null]))->assertUnprocessable();
        $this->assertStringNotContainsString('Private Tenant', json_encode($this->getJson('/api/public/site')->assertOk()->json()));
        CarbonImmutable::setTestNow();
    }

    public function test_partial_months_are_full_and_advance_covers_unpaid_final_month_only(): void
    {
        CarbonImmutable::setTestNow('2026-02-28');
        $contract = $this->activeContract();
        $active = $this->getJson('/api/staff/ledgers')->assertOk()->json((string) $contract->id);
        $this->assertSame('5000.00', $active['installments'][0]['amount']);
        $this->assertSame('5000.00', $active['installments'][1]['amount']);
        $this->assertSame('0.00', $active['advance_applied']);
        $this->postJson("/api/contracts/$contract->id/end", [
            'ended_on' => '2026-02-15', 'end_review_note' => 'Move-out inspection complete',
        ])->assertOk();
        $ended = $this->getJson('/api/staff/ledgers')->assertOk()->json((string) $contract->id);
        $this->assertCount(2, $ended['installments']);
        $this->assertSame('5000.00', $ended['installments'][1]['amount']);
        $this->assertSame('5000.00', $ended['installments'][1]['advance_applied']);
        $this->assertSame('0.00', $ended['installments'][1]['balance']);
        $this->assertSame('0.00', $ended['due_balance']);
        $this->assertSame('0.00', $ended['advance_remaining']);
        $this->assertSame('5000.00', $ended['deposit_paid']);
        CarbonImmutable::setTestNow();
    }

    public function test_paid_final_month_leaves_advance_unapplied(): void
    {
        CarbonImmutable::setTestNow('2026-02-28');
        $contract = $this->activeContract();
        $this->postJson("/api/contracts/$contract->id/payments", [
            'submission_key' => (string) Str::uuid(), 'kind' => 'rent', 'period_month' => '2026-02',
            'paid_on' => '2026-02-10', 'amount' => '5000', 'method' => 'cash',
        ])->assertCreated();
        $this->postJson("/api/contracts/$contract->id/end", [
            'ended_on' => '2026-02-15', 'end_review_note' => 'Final rent already paid',
        ])->assertOk();
        $ended = $this->getJson('/api/staff/ledgers')->assertOk()->json((string) $contract->id);
        $this->assertSame('0.00', $ended['advance_applied']);
        $this->assertSame('5000.00', $ended['advance_remaining']);
        $this->assertSame('0.00', $ended['installments'][1]['balance']);
        CarbonImmutable::setTestNow();
    }

    public function test_staff_can_void_later_rent_with_a_reason_without_erasing_history(): void
    {
        CarbonImmutable::setTestNow('2026-02-28');
        $contract = $this->activeContract();
        $payload = ['submission_key' => (string) Str::uuid(), 'kind' => 'rent', 'period_month' => '2026-02',
            'paid_on' => '2026-02-10', 'amount' => '2000.00', 'method' => 'cash'];
        $payment = $this->postJson("/api/contracts/$contract->id/payments", $payload)->assertCreated()->json();
        $url = "/api/contracts/$contract->id/payments/{$payment['id']}/void";
        $this->postJson($url, ['reason' => ''])->assertUnprocessable();
        $this->postJson($url, ['reason' => 'Entered against the wrong month'])->assertOk();
        $this->postJson($url, ['reason' => 'Again'])->assertUnprocessable();
        $this->postJson("/api/contracts/$contract->id/payments", $payload)->assertUnprocessable()->assertJsonValidationErrors('submission_key');
        $this->getJson('/api/staff/ledgers')->assertOk()
            ->assertJsonPath($contract->id.'.due_balance', '5000.00')
            ->assertJsonPath($contract->id.'.payments.0.void_reason', 'Entered against the wrong month');
        $signingPayment = $contract->payments()->where('kind', 'rent')->firstOrFail();
        $this->postJson("/api/contracts/$contract->id/payments/$signingPayment->id/void", ['reason' => 'Mistake'])->assertUnprocessable();
        auth()->logout();
        $this->postJson($url, ['reason' => 'Guest'])->assertUnauthorized();
        CarbonImmutable::setTestNow();
    }

    public function test_dashboard_highlights_expiring_contract_and_latest_repair_checklist(): void
    {
        CarbonImmutable::setTestNow('2026-03-20');
        $contract = $this->activeContract();
        $areas = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];
        $items = array_map(fn ($area) => ['area' => $area, 'condition' => $area === 'sink' ? 'needs_repair' : 'good'], $areas);
        $this->postJson("/api/rooms/$contract->room_id/inspections", [
            'type' => 'routine', 'inspected_on' => '2026-03-19', 'items' => $items,
        ])->assertCreated();
        $this->getJson('/api/staff/dashboard')->assertOk()
            ->assertJsonPath('expiring_contracts.0.contract_id', $contract->id)
            ->assertJsonPath('repair_checklists.0.room_id', $contract->room_id)
            ->assertJsonPath('repair_checklists.0.areas.0', 'sink');
        CarbonImmutable::setTestNow();
    }

    public function test_payment_export_is_staff_only_and_preserves_void_history(): void
    {
        $contract = $this->activeContract();
        $payment = $this->postJson("/api/contracts/$contract->id/payments", [
            'submission_key' => (string) Str::uuid(), 'kind' => 'rent', 'period_month' => '2026-02',
            'paid_on' => '2026-02-10', 'amount' => '2000.00', 'method' => 'cash',
        ])->assertCreated()->json();
        $this->postJson("/api/contracts/$contract->id/payments/{$payment['id']}/void", ['reason' => 'Wrong receipt'])->assertOk();
        $export = $this->get('/api/staff/payments-export?from=2026-02-01&to=2026-02-28')->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Wrong receipt', $export->streamedContent());
        $this->assertStringContainsString('Voided', $export->streamedContent());
        $this->assertStringNotContainsString('Emergency', $export->streamedContent());
        $this->getJson('/api/staff/payments-export?from=2025-01-01&to=2026-02-28')->assertUnprocessable();
        auth()->logout();
        $this->getJson('/api/staff/payments-export?from=2026-02-01&to=2026-02-28')->assertUnauthorized();
    }

    public function test_staff_settles_rent_credit_and_move_out_deposit_with_evidence(): void
    {
        Storage::fake('local');
        $contract = $this->activeContract();
        $payment = $this->postJson("/api/contracts/$contract->id/payments", [
            'submission_key' => (string) Str::uuid(), 'kind' => 'rent', 'period_month' => '2026-02',
            'paid_on' => '2026-02-10', 'amount' => '6000.00', 'method' => 'cash',
        ])->assertCreated()->json();
        $this->getJson('/api/staff/ledgers')->assertJsonPath($contract->id.'.rent_credit', '1000.00');
        $url = "/api/contracts/$contract->id/adjustments";
        $rentRefund = ['kind' => 'rent_refund', 'amount' => '1000.00', 'occurred_on' => '2026-02-11',
            'method' => 'cash', 'reason' => 'Tenant overpaid February rent'];
        $this->postJson($url, [...$rentRefund, 'amount' => '1001.00'])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->postJson($url, $rentRefund)->assertCreated()->assertJsonPath('approver.name', 'Staff');
        $this->postJson("/api/contracts/$contract->id/payments/{$payment['id']}/void", ['reason' => 'Wrong payment'])->assertUnprocessable();
        $this->postJson("/api/contracts/$contract->id/end", ['ended_on' => '2026-02-15', 'end_review_note' => 'Move-out reviewed'])->assertOk();

        $areas = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];
        $items = array_map(fn ($area) => ['area' => $area, 'condition' => $area === 'paint' ? 'needs_repair' : 'good'], $areas);
        $inspection = $this->postJson("/api/rooms/$contract->room_id/inspections", [
            'type' => 'move_out', 'contract_id' => $contract->id, 'inspected_on' => '2026-02-15', 'items' => $items,
        ])->assertCreated()->json('id');
        $deduction = ['kind' => 'deposit_deduction', 'amount' => '1000.00', 'occurred_on' => '2026-02-15',
            'reason' => 'Paint repair after move-out', 'inspection_id' => $inspection];
        $this->postJson($url, $deduction)->assertUnprocessable()->assertJsonValidationErrors('inspection_id');
        $this->postJson("/api/inspections/$inspection/photos", [
            'photo' => UploadedFile::fake()->createWithContent('paint.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==')),
        ])->assertCreated();
        $this->postJson($url, $deduction)->assertCreated();
        $this->getJson('/api/staff/ledgers')->assertJsonPath($contract->id.'.deposit_refundable', '4000.00');
        $this->postJson($url, ['kind' => 'deposit_refund', 'amount' => '4000.00', 'occurred_on' => '2026-02-16',
            'method' => 'cash', 'reason' => 'Return remaining deposit'])->assertCreated();
        $this->postJson($url, ['kind' => 'advance_refund', 'amount' => '5000.00', 'occurred_on' => '2026-02-16',
            'method' => 'cash', 'reason' => 'Unused final month advance'])->assertCreated();
        $this->getJson('/api/staff/ledgers')->assertJsonPath($contract->id.'.rent_credit', '0.00')
            ->assertJsonPath($contract->id.'.deposit_refundable', '0.00')
            ->assertJsonPath($contract->id.'.advance_refundable', '0.00');
        $this->assertStringContainsString('Settlement: deposit_deduction', $this->get('/api/staff/payments-export?from=2026-02-01&to=2026-02-28')->assertOk()->streamedContent());
        auth()->logout();
        $this->postJson($url, $deduction)->assertUnauthorized();
    }

    public function test_inspections_validate_all_areas_and_keep_photos_private(): void
    {
        Storage::fake('local');
        $contract = $this->activeContract();
        $areas = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];
        $items = array_map(fn ($area) => ['area' => $area, 'condition' => 'good', 'notes' => 'Checked'], $areas);
        $url = "/api/rooms/$contract->room_id/inspections";
        $this->postJson($url, ['type' => 'routine', 'inspected_on' => '2026-02-01', 'items' => array_slice($items, 1)])->assertUnprocessable();
        $inspection = $this->postJson($url, ['type' => 'move_in', 'contract_id' => $contract->id,
            'inspected_on' => '2026-01-15', 'notes' => 'Keys handed over', 'items' => $items])->assertCreated()->json('id');
        $this->getJson($url)->assertOk()->assertJsonCount(8, '0.items')->assertJsonPath('0.inspector.name', 'Staff');
        $photo = $this->postJson("/api/inspections/$inspection/photos", [
            'photo' => UploadedFile::fake()->createWithContent('sink.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==')),
        ])->assertCreated()->json('id');
        $this->get("/api/inspections/$inspection/photos/$photo")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->get('/api/inspections/999/photos/'.$photo)->assertNotFound();
        $this->assertStringNotContainsString('Keys handed over', json_encode($this->getJson('/api/public/site')->assertOk()->json()));
    }

    public function test_payment_and_inspection_routes_require_staff_role(): void
    {
        $this->seed();
        $tenant = Tenant::create(['full_name' => 'Private Tenant']);
        Contract::create(['tenant_id' => $tenant->id, 'room_id' => Room::firstOrFail()->id,
            'signed_on' => '2026-01-01', 'starts_on' => '2026-01-01', 'ends_on' => '2027-01-01',
            'monthly_rent' => '5000', 'due_day' => 1, 'advance_amount' => '5000', 'deposit_amount' => '5000']);
        foreach (['/api/staff/dashboard', '/api/staff/ledgers', '/api/rooms/1/inspections'] as $route) {
            $this->getJson($route)->assertUnauthorized();
        }
        $this->postJson('/api/contracts/1/payments', [])->assertUnauthorized();
        $this->postJson('/api/rooms/1/inspections', [])->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => 'long-secret-password', 'role' => 'viewer']));
        $this->getJson('/api/staff/ledgers')->assertForbidden();
        $this->getJson('/api/rooms/1/inspections')->assertForbidden();
        $this->postJson('/api/contracts/1/payments', [])->assertForbidden();
    }
}
