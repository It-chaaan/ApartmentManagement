<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('staff:create-owner', function () {
    if (User::where('role', 'owner')->exists()) {
        $this->error('An owner account already exists.');

        return 1;
    }
    $name = $this->ask('Owner name');
    $email = $this->ask('Owner email');
    $password = $this->secret('Password (12 characters minimum)');
    $confirm = $this->secret('Confirm password');
    if (! $name || ! filter_var($email, FILTER_VALIDATE_EMAIL) || User::where('email', $email)->exists() || strlen($password ?? '') < 12 || $password !== $confirm) {
        $this->error('Invalid name, email, or password; or passwords do not match.');

        return 1;
    }
    User::create(['name' => $name, 'email' => $email, 'password' => $password, 'role' => 'owner']);
    $this->info('Owner account created.');

    return 0;
})->purpose('Interactively create the first owner account');

Artisan::command('staff:change-owner-email', function () {
    $email = $this->ask('Current owner email');
    $password = $this->secret('Owner password');
    $newEmail = $this->ask('New owner email');
    $owner = User::where('role', 'owner')->where('email', $email)->first();
    if (! $owner || ! Hash::check((string) $password, $owner->password) || ! filter_var($newEmail, FILTER_VALIDATE_EMAIL) || User::where('email', $newEmail)->where('id', '!=', $owner->id)->exists()) {
        $this->error('Owner credentials or new email are invalid.');

        return 1;
    }

    $owner->update(['email' => $newEmail]);
    $owner->increment('staff_session_version');
    DB::table('sessions')->where('user_id', $owner->id)->delete();
    DB::table('staff_email_challenges')->where('user_id', $owner->id)->delete();
    $this->info('Owner email updated. Sign in to request a new code.');

    return 0;
})->purpose('Change the owner sign-in email from the local server');
