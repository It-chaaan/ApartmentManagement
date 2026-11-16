<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffRole
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->is_active && in_array($request->user()?->role, ['owner', 'staff'], true), 403);
        abort_unless(! config('app.staff_mfa_required') || $request->session()->get('staff_session_version') === $request->user()->staff_session_version, 403);
        abort_unless(! config('app.staff_mfa_required') || $request->session()->get('staff_email_verified') === true, 403);

        return $next($request);
    }
}
