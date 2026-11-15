<?php

namespace Tests\Feature;

use App\Mail\TenantInvitationMail;
use App\Models\Contract;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TenantPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_invitation_requires_identity_check_and_signed_contract(): void
    {
        Mail::fake();
        $this->seed();
        $staff = User::create(['name' => 'Staff', 'email' => 'staff-portal@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $tenant = Tenant::create(['full_name' => 'Alex Sample', 'email' => 'alex@example.test']);
        $this->actingAs($staff);
        $this->postJson("/api/tenants/{$tenant->id}/invite", ['identity_checked' => true])->assertUnprocessable();
        $this->signedContract($tenant);
        $this->postJson("/api/tenants/{$tenant->id}/invite", [])->assertUnprocessable();
        $this->postJson("/api/tenants/{$tenant->id}/invite", ['identity_checked' => true])->assertOk();
        Mail::assertSentCount(1);
        Mail::assertSent(TenantInvitationMail::class, fn (TenantInvitationMail $mail): bool => $mail->hasTo('alex@example.test'));
        $account = User::where('email', 'alex@example.test')->firstOrFail();
        $this->assertSame('tenant', $account->role);
        $this->assertFalse($account->is_active);
        $this->assertSame($tenant->id, $account->tenant_id);
        $this->assertDatabaseCount('tenant_invitations', 1);
        $this->getJson('/api/tenant/contracts')->assertForbidden();
        parse_str((string) parse_url(Mail::sent(TenantInvitationMail::class)->first()->activationUrl, PHP_URL_QUERY), $query);
        $this->postJson('/api/tenant/activate', ['token' => $query['token'], 'password' => 'new-long-password', 'password_confirmation' => 'new-long-password'])->assertOk();
        $this->getJson('/api/tenant/contracts')->assertOk()->assertJsonCount(1);
        $this->actingAs($staff);
        $this->putJson("/api/tenants/{$tenant->id}", ['full_name' => 'Alex Sample', 'email' => 'alex-new@example.test'])->assertOk();
        $this->actingAs($account->fresh());
        $this->getJson('/api/tenant/contracts')->assertForbidden();
        $this->actingAs($staff);
        $this->postJson("/api/tenants/{$tenant->id}/invite", ['identity_checked' => true])->assertOk();
        $this->assertSame($account->id, User::where('email', 'alex-new@example.test')->firstOrFail()->id);
        $this->assertFalse($account->fresh()->is_active);
        $this->getJson("/api/tenants/{$tenant->id}/portal-access")->assertOk()->assertJsonPath('invitation_pending', true);
        parse_str((string) parse_url(Mail::sent(TenantInvitationMail::class)->last()->activationUrl, PHP_URL_QUERY), $newQuery);
        $this->postJson("/api/tenants/{$tenant->id}/portal-access/revoke")->assertOk()
            ->assertJsonPath('enabled', false)->assertJsonPath('invitation_pending', false);
        $this->travel(61)->seconds();
        $this->postJson('/api/tenant/activate', ['token' => $newQuery['token'], 'password' => 'another-long-password', 'password_confirmation' => 'another-long-password'])->assertUnprocessable();
    }

    public function test_tenant_activation_is_single_use_and_the_portal_is_scoped_to_own_records(): void
    {
        $this->seed();
        $staff = User::create(['name' => 'Staff', 'email' => 'staff-portal@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $first = Tenant::create(['full_name' => 'Alex Sample', 'email' => 'alex@example.test']);
        $second = Tenant::create(['full_name' => 'Other Sample', 'email' => 'other@example.test']);
        $ownContract = $this->signedContract($first);
        $otherContract = $this->signedContract($second, Room::skip(1)->firstOrFail());
        $ownContract->payments()->create(['kind' => 'rent', 'period_month' => '2026-02-01', 'paid_on' => '2026-02-15', 'amount' => '5000.00', 'method' => 'cash', 'submission_key' => '11111111-1111-4111-8111-111111111111']);
        $ownContract->payments()->create(['kind' => 'rent_transfer_out', 'period_month' => null, 'paid_on' => '2026-02-15', 'amount' => '1000.00', 'method' => 'not_recorded', 'submission_key' => '22222222-2222-4222-8222-222222222222']);
        $otherFile = $otherContract->files()->create(['path' => 'contracts/private.pdf', 'original_name' => 'private.pdf', 'uploaded_by' => $staff->id, 'kind' => 'signed']);
        $account = User::create(['name' => 'Alex Sample', 'email' => 'alex@example.test', 'password' => 'unused-long-password', 'role' => 'tenant', 'tenant_id' => $first->id, 'is_active' => false]);
        DB::table('tenant_invitations')->insert([
            'user_id' => $account->id, 'invited_by' => $staff->id, 'token_hash' => hash('sha256', str_repeat('a', 64)),
            'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->getJson('/api/tenant/contracts')->assertUnauthorized();
        $this->postJson('/api/tenant/activate', ['token' => str_repeat('a', 64), 'password' => 'new-long-password', 'password_confirmation' => 'new-long-password'])->assertOk();
        $this->postJson('/api/tenant/activate', ['token' => str_repeat('a', 64), 'password' => 'another-long-password', 'password_confirmation' => 'another-long-password'])->assertUnprocessable();
        $response = $this->getJson('/api/tenant/contracts')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $ownContract->id)->assertJsonCount(1, '0.payments')
            ->assertJsonPath('0.payments.0.kind', 'rent');
        $this->assertArrayNotHasKey('files', $response->json('0'));
        $this->assertArrayNotHasKey('end_review_note', $response->json('0'));
        $this->getJson('/api/tenants')->assertForbidden();
        $this->getJson('/api/utility-email-imports')->assertForbidden();
        $this->getJson("/api/tenants/{$second->id}/portal-access")->assertForbidden();
        $this->getJson("/api/contracts/{$otherContract->id}/files/{$otherFile->id}")->assertForbidden();
        $this->postJson('/api/tenant/logout')->assertOk();
        $this->getJson('/api/tenant/contracts')->assertUnauthorized();
        $this->postJson('/api/login', ['email' => 'alex@example.test', 'password' => 'new-long-password'])->assertUnprocessable();
        $this->postJson('/api/tenant/login', ['email' => 'alex@example.test', 'password' => 'new-long-password'])->assertOk();
        $account->update(['password' => 'changed-long-password']);
        auth()->setUser($account->fresh());
        $this->getJson('/api/tenant/contracts')->assertForbidden();
        $this->actingAs($staff);
        $this->getJson('/api/tenant/contracts')->assertForbidden();
    }

    private function signedContract(Tenant $tenant, ?Room $room = null): Contract
    {
        return Contract::create([
            'tenant_id' => $tenant->id, 'room_id' => ($room ?? Room::firstOrFail())->id,
            'signed_on' => '2026-01-01', 'starts_on' => '2026-01-15', 'ends_on' => '2027-01-15',
            'monthly_rent' => '5000.00', 'due_day' => 15, 'advance_amount' => '5000.00',
            'deposit_amount' => '5000.00', 'status' => 'signed',
        ]);
    }
}
