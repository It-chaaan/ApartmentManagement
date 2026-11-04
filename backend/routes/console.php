<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

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
