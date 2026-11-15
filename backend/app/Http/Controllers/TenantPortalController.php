<?php

namespace App\Http\Controllers;

use App\Mail\TenantInvitationMail;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantPortalController extends Controller
{
    public function status(Tenant $tenant): JsonResponse
    {
        $user = User::where('tenant_id', $tenant->id)->first();

        return response()->json([
            'enabled' => (bool) ($user?->is_active && $user->email_verified_at && $user->email === Str::lower((string) $tenant->email)),
            'invitation_pending' => $user ? DB::table('tenant_invitations')->where('user_id', $user->id)->whereNull('used_at')->where('expires_at', '>', now())->exists() : false,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function revoke(Tenant $tenant): JsonResponse
    {
        DB::transaction(function () use ($tenant): void {
            $user = User::where('tenant_id', $tenant->id)->lockForUpdate()->first();
            if (! $user) {
                return;
            }
            $user->update(['is_active' => false]);
            DB::table('tenant_invitations')->where('user_id', $user->id)->whereNull('used_at')->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });

        return $this->status($tenant);
    }

    public function invite(Request $request, Tenant $tenant): JsonResponse
    {
        $request->validate(['identity_checked' => ['required', 'accepted']]);
        if (! $tenant->email || ! filter_var($tenant->email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['email' => 'Record a valid tenant email before inviting them.']);
        }
        if (! $tenant->contracts()->whereIn('status', ['signed', 'active', 'ended', 'renewed'])->exists()) {
            throw ValidationException::withMessages(['tenant' => 'A signed tenancy is required before portal access.']);
        }

        $email = Str::lower($tenant->email);
        $emailAccount = User::where('email', $email)->first();
        if ($emailAccount && ($emailAccount->role !== 'tenant' || $emailAccount->tenant_id !== $tenant->id)) {
            throw ValidationException::withMessages(['email' => 'This email already belongs to another account.']);
        }
        $existing = User::where('tenant_id', $tenant->id)->first();

        $token = Str::random(64);
        DB::transaction(function () use ($request, $tenant, $email, $existing, $token): void {
            $user = $existing ?? User::create([
                'name' => $tenant->full_name, 'email' => $email, 'password' => Str::random(64),
                'role' => 'tenant', 'tenant_id' => $tenant->id, 'is_active' => false,
            ]);
            if ($existing) {
                $user->update(['name' => $tenant->full_name, 'email' => $email, 'is_active' => false, 'email_verified_at' => null]);
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
            DB::table('tenant_invitations')->where('user_id', $user->id)->whereNull('used_at')->delete();
            DB::table('tenant_invitations')->insert([
                'user_id' => $user->id, 'invited_by' => $request->user()->id,
                'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDay(),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        $url = rtrim(config('app.frontend_url'), '/').'/tenant/activate?token='.$token;
        Mail::to($email)->send(new TenantInvitationMail($url));

        return response()->json(['message' => config('mail.default') === 'log'
            ? 'Invitation written to the local mail log. Configure a mail provider before inviting real tenants.'
            : 'Invitation sent to the tenant email on record.']);
    }

    public function activate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:64'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ]);
        $user = DB::transaction(function () use ($data): User {
            $invitation = DB::table('tenant_invitations')->where('token_hash', hash('sha256', $data['token']))->lockForUpdate()->first();
            if (! $invitation || $invitation->used_at || now()->greaterThan($invitation->expires_at)) {
                throw ValidationException::withMessages(['token' => 'This invitation is invalid or expired. Ask staff for a new one.']);
            }
            $user = User::whereKey($invitation->user_id)->lockForUpdate()->firstOrFail();
            abort_unless($user->role === 'tenant' && $user->tenant_id, 403);
            $user->update(['password' => $data['password'], 'is_active' => true, 'email_verified_at' => now()]);
            DB::table('tenant_invitations')->where('id', $invitation->id)->update(['used_at' => now(), 'updated_at' => now()]);

            return $user;
        });
        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->put('tenant_auth_version', hash('sha256', $user->getAuthPassword()));

        return response()->json(['user' => ['name' => $user->name, 'email' => $user->email]])->header('Cache-Control', 'private, no-store');
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        if (! Auth::attempt($credentials + ['role' => 'tenant', 'is_active' => true])) {
            return response()->json(['message' => 'The email or password is incorrect.'], 422);
        }
        $request->session()->regenerate();
        $request->session()->put('tenant_auth_version', hash('sha256', $request->user()->getAuthPassword()));

        return $this->me($request);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $this->tenantUser($request);

        return response()->json(['user' => ['name' => $user->name, 'email' => $user->email]])->header('Cache-Control', 'private, no-store');
    }

    public function contracts(Request $request): JsonResponse
    {
        $user = $this->tenantUser($request);
        $contracts = Contract::with(['room.building:id,name', 'payments'])
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['signed', 'active', 'ended', 'renewed'])
            ->orderByDesc('starts_on')->get();

        return response()->json($contracts->map(fn (Contract $contract): array => [
            'id' => $contract->id,
            'status' => $contract->status,
            'room' => ['code' => $contract->room->code, 'building' => $contract->room->building->name],
            'starts_on' => $contract->starts_on->format('Y-m-d'),
            'ends_on' => $contract->ends_on->format('Y-m-d'),
            'monthly_rent' => $contract->monthly_rent,
            'advance_amount' => $contract->advance_amount,
            'deposit_amount' => $contract->deposit_amount,
            'payments' => $contract->payments->whereNull('voided_at')->whereIn('kind', ['rent', 'advance', 'deposit'])->map(fn ($payment): array => [
                'kind' => $payment->kind, 'period_month' => $payment->period_month?->format('Y-m'),
                'paid_on' => $payment->paid_on->format('Y-m-d'), 'amount' => $payment->amount,
            ])->values(),
        ]))->header('Cache-Control', 'private, no-store');
    }

    private function tenantUser(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->is_active && $user->role === 'tenant' && $user->tenant_id && $user->email_verified_at, 403);
        abort_unless(hash_equals(hash('sha256', $user->getAuthPassword()), (string) $request->session()->get('tenant_auth_version')), 403);
        abort_unless(Str::lower((string) Tenant::find($user->tenant_id)?->email) === $user->email, 403);

        return $user;
    }
}
