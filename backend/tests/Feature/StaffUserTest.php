<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaffUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_lists_creates_and_disables_staff_without_exposing_passwords(): void
    {
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'long-secret-password', 'role' => 'owner']);
        $this->actingAs($owner);
        $staff = $this->postJson('/api/staff', [
            'name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'another-long-password', 'password_confirmation' => 'another-long-password',
        ])->assertCreated()->assertJsonPath('user.role', 'staff')->json('user');
        $this->getJson('/api/staff-users')->assertOk()->assertJsonCount(2)->assertDontSee('another-long-password');
        $this->patchJson('/api/staff-users/'.$staff['id'], ['password' => 'updated-long-password', 'password_confirmation' => 'updated-long-password'])->assertOk();
        $this->assertTrue(Hash::check('updated-long-password', User::findOrFail($staff['id'])->password));
        $this->patchJson('/api/staff-users/'.$staff['id'], ['is_active' => false])->assertOk()->assertJsonPath('is_active', false);
        $this->assertDatabaseHas('users', ['id' => $staff['id'], 'is_active' => false]);
        $this->actingAs(User::findOrFail($staff['id']))->getJson('/api/me')->assertForbidden();
    }

    public function test_only_owner_can_manage_staff_and_owner_cannot_be_disabled(): void
    {
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'long-secret-password', 'role' => 'owner']);
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $this->actingAs($staff)->getJson('/api/staff-users')->assertForbidden();
        $this->patchJson('/api/staff-users/'.$staff->id, ['is_active' => false])->assertForbidden();
        $this->actingAs($owner)->patchJson('/api/staff-users/'.$owner->id, ['is_active' => false])->assertForbidden();
        $this->patchJson('/api/staff-users/'.$staff->id, ['email' => $owner->email])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_disabled_staff_cannot_sign_in(): void
    {
        User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff', 'is_active' => false]);
        $this->postJson('/api/login', ['email' => 'staff@example.test', 'password' => 'long-secret-password'])->assertUnprocessable();
    }
}
