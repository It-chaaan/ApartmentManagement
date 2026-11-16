<?php

namespace Tests\Feature;

use App\Mail\StaffSignInCodeMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class StaffMfaTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_needs_a_one_use_emailed_code_before_management_access(): void
    {
        config()->set('app.staff_mfa_required', true);
        Mail::fake();
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);

        $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'long-secret-password'])
            ->assertOk()->assertJsonPath('state', 'email_required');
        $this->getJson('/api/me')->assertForbidden();
        $this->postJson('/api/staff/mfa/verify', ['code' => '123456'])->assertUnprocessable();
        $this->postJson('/api/staff/mfa/send')->assertOk()->assertDontSee('123456');
        Mail::assertSentCount(1);
        Mail::assertSent(StaffSignInCodeMail::class, fn (StaffSignInCodeMail $mail): bool => $mail->hasTo($staff->email));
        $code = Mail::sent(StaffSignInCodeMail::class)->first()->code;
        $this->assertNotSame($code, DB::table('staff_email_challenges')->where('user_id', $staff->id)->value('code_hash'));
        $wrongCode = ($code[0] === '0' ? '1' : '0').substr($code, 1);
        $this->postJson('/api/staff/mfa/verify', ['code' => $wrongCode])->assertUnprocessable();
        $this->assertDatabaseHas('staff_email_challenges', ['user_id' => $staff->id, 'attempts' => 1]);
        $this->postJson('/api/staff/mfa/verify', ['code' => $code])->assertOk()->assertJsonPath('state', 'verified');
        $this->getJson('/api/me')->assertOk();
        $this->assertDatabaseMissing('staff_email_challenges', ['user_id' => $staff->id]);

        $this->postJson('/api/logout')->assertOk();
        $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'long-secret-password'])
            ->assertOk()->assertJsonPath('state', 'email_required');
        $this->postJson('/api/staff/mfa/verify', ['code' => $code])->assertUnprocessable();
        $this->getJson('/api/me')->assertForbidden();
    }

    public function test_code_expires_and_resend_has_a_cooldown(): void
    {
        config()->set('app.staff_mfa_required', true);
        Mail::fake();
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'long-secret-password'])->assertOk();
        $this->postJson('/api/staff/mfa/send')->assertOk();
        $code = Mail::sent(StaffSignInCodeMail::class)->first()->code;
        $this->postJson('/api/staff/mfa/send')->assertUnprocessable();
        $this->travel(6)->minutes();
        $this->postJson('/api/staff/mfa/verify', ['code' => $code])->assertUnprocessable();
        $this->postJson('/api/staff/mfa/send')->assertOk();
        $newCode = Mail::sent(StaffSignInCodeMail::class)->last()->code;
        $this->postJson('/api/staff/mfa/verify', ['code' => $newCode])->assertOk();
    }

    public function test_five_wrong_codes_block_even_the_correct_code(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        config()->set('app.staff_mfa_required', true);
        Mail::fake();
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'long-secret-password'])->assertOk();
        $this->postJson('/api/staff/mfa/send')->assertOk();
        $code = Mail::sent(StaffSignInCodeMail::class)->first()->code;
        $wrongCode = ($code[0] === '0' ? '1' : '0').substr($code, 1);
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/staff/mfa/verify', ['code' => $wrongCode])->assertUnprocessable();
        }
        $this->assertDatabaseHas('staff_email_challenges', ['user_id' => $staff->id, 'attempts' => 5]);
        $this->postJson('/api/staff/mfa/verify', ['code' => $code])->assertUnprocessable();
        $this->getJson('/api/me')->assertForbidden();
    }

    public function test_owner_email_change_invalidates_a_pending_code_and_old_session(): void
    {
        Mail::fake();
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'long-secret-password', 'role' => 'owner']);
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        config()->set('app.staff_mfa_required', true);
        $this->postJson('/api/login', ['email' => $staff->email, 'password' => 'long-secret-password'])->assertOk();
        $this->postJson('/api/staff/mfa/send')->assertOk();
        $this->actingAs($owner);
        config()->set('app.staff_mfa_required', false);
        $this->patchJson('/api/staff-users/'.$staff->id, ['email' => 'new-staff@example.test'])->assertOk();
        $this->assertDatabaseMissing('staff_email_challenges', ['user_id' => $staff->id]);
        $this->assertSame(1, $staff->fresh()->staff_session_version);
        config()->set('app.staff_mfa_required', true);
        $this->withSession(['staff_session_version' => 0, 'staff_email_verified' => true])
            ->actingAs($staff->fresh())->getJson('/api/me')->assertForbidden();
    }
}
