<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\StaffEmailChallenge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffMfaController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $this->staffUser($request);

        return response()->json(['state' => $this->state($request)]);
    }

    public function send(Request $request, StaffEmailChallenge $challenge): JsonResponse
    {
        $user = $this->staffUser($request);
        abort_unless(config('app.staff_mfa_required') && $request->session()->get('staff_email_verified') !== true, 409);
        $challenge->send($user);

        return response()->json(['message' => 'A six-digit sign-in code was sent to your staff email.']);
    }

    public function verify(Request $request, StaffEmailChallenge $challenge): JsonResponse
    {
        $user = $this->staffUser($request);
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        abort_unless(config('app.staff_mfa_required'), 409);
        $challenge->verify($user, $data['code']);
        $request->session()->put('staff_email_verified', true);

        return response()->json(['state' => 'verified', 'user' => $user->only('id', 'name', 'email', 'role')]);
    }

    private function staffUser(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->is_active && in_array($user?->role, ['owner', 'staff'], true), 403);
        abort_unless(! config('app.staff_mfa_required') || $request->session()->get('staff_session_version') === $user->staff_session_version, 403);

        return $user;
    }

    private function state(Request $request): string
    {
        if (! config('app.staff_mfa_required') || $request->session()->get('staff_email_verified') === true) {
            return 'verified';
        }

        return 'email_required';
    }
}
