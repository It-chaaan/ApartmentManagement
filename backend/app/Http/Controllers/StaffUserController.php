<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'owner', 403);

        return response()->json(User::whereIn('role', ['owner', 'staff'])->orderBy('name')->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->role === 'owner', 403);
        abort_unless($user->role === 'staff', 403);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'required', 'string', 'min:12', 'confirmed'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);
        unset($data['password_confirmation']);
        $user->update($data);

        return response()->json($user->only('id', 'name', 'email', 'role', 'is_active', 'created_at'));
    }
}
