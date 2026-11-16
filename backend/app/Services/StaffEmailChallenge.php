<?php

namespace App\Services;

use App\Mail\StaffSignInCodeMail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

class StaffEmailChallenge
{
    public function send(User $user): void
    {
        if (in_array(config('mail.default'), ['log', 'array'], true) && ! app()->environment(['testing', 'e2e'])) {
            throw ValidationException::withMessages(['email' => 'Configure Gmail SMTP before requesting a staff sign-in code.']);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = $this->hash($user, $code);
        $now = now();
        DB::transaction(function () use ($user, $codeHash, $now): void {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $challenge = DB::table('staff_email_challenges')->where('user_id', $user->id)->first();
            if ($challenge && Carbon::parse($challenge->sent_at)->greaterThan($now->copy()->subMinute())) {
                throw ValidationException::withMessages(['email' => 'Wait one minute before requesting another code.']);
            }

            DB::table('staff_email_challenges')->updateOrInsert(['user_id' => $user->id], [
                'code_hash' => $codeHash,
                'expires_at' => $now->copy()->addMinutes(5),
                'sent_at' => $now,
                'attempts' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        try {
            Mail::to($user->email)->send(new StaffSignInCodeMail($code));
        } catch (Throwable $exception) {
            DB::table('staff_email_challenges')->where('user_id', $user->id)->where('code_hash', $codeHash)->delete();
            Log::warning('Staff sign-in email delivery failed.', ['exception' => $exception::class]);
            throw ValidationException::withMessages(['email' => 'The sign-in code could not be sent. Check the local mail settings and try again.']);
        }
    }

    public function verify(User $user, string $code): void
    {
        $result = DB::transaction(function () use ($user, $code): string {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $challenge = DB::table('staff_email_challenges')->where('user_id', $user->id)->lockForUpdate()->first();
            if (! $challenge) {
                return 'missing';
            }
            if (Carbon::parse($challenge->expires_at)->isPast()) {
                DB::table('staff_email_challenges')->where('id', $challenge->id)->delete();

                return 'expired';
            }
            if ($challenge->attempts >= 5) {
                return 'attempts';
            }
            if (! hash_equals($challenge->code_hash, $this->hash($user, $code))) {
                DB::table('staff_email_challenges')->where('id', $challenge->id)->increment('attempts');

                return 'invalid';
            }
            DB::table('staff_email_challenges')->where('id', $challenge->id)->delete();

            return 'valid';
        });

        if ($result !== 'valid') {
            $message = match ($result) {
                'expired' => 'This code has expired. Request a new one.',
                'attempts' => 'Too many incorrect codes. Request a new one.',
                'missing' => 'Request a new sign-in code.',
                default => 'The sign-in code is incorrect.',
            };
            throw ValidationException::withMessages(['code' => $message]);
        }
    }

    private function hash(User $user, string $code): string
    {
        return hash_hmac('sha256', $user->id.':'.$code, (string) config('app.key'));
    }
}
