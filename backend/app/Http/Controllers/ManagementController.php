<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\Contract;
use App\Models\Room;
use App\Models\RoomPhoto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ManagementController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        if (! Auth::attempt($credentials)) {
            return response()->json(['message' => 'The email or password is incorrect.'], 422);
        }
        $request->session()->regenerate();

        return response()->json(['user' => $request->user()->only('id', 'name', 'email', 'role')]);
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
        return response()->json(['user' => $request->user()->only('id', 'name', 'email', 'role')]);
    }

    public function buildings(): JsonResponse
    {
        return response()->json(Building::withCount('rooms')->orderBy('id')->get());
    }

    public function updateBuilding(Request $request, Building $building): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'lot_area_sqm' => ['sometimes', 'required', 'numeric', 'gt:0', 'max:999999.99'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'amenities' => ['sometimes', 'required', 'array'],
            'amenities.*' => ['string', 'max:100'],
        ]);
        $building->update($data);

        return response()->json($building->loadCount('rooms'));
    }

    public function rooms(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'building_id' => ['sometimes', 'integer', 'exists:buildings,id'],
            'floor' => ['sometimes', 'integer', 'between:1,2'],
            'status' => ['sometimes', Rule::in(['unverified', 'available', 'reserved', 'occupied', 'maintenance'])],
        ]);
        $query = Room::with(['building:id,name', 'photos'])->orderBy('building_id')->orderBy('floor')->orderBy('code');
        foreach ($filters as $key => $value) {
            $query->where($key, $value);
        }

        return response()->json($query->get());
    }

    public function room(Room $room): JsonResponse
    {
        return response()->json($room->load(['building', 'photos']));
    }

    public function updateRoom(Request $request, Room $room): JsonResponse
    {
        $data = $request->validate([
            'floor' => ['sometimes', 'required', 'integer', 'between:1,2'],
            'side' => ['sometimes', 'nullable', Rule::in(['left', 'right'])],
            'size_min_sqm' => ['sometimes', 'required', 'numeric', 'gt:0', 'max:9999.99'],
            'size_max_sqm' => ['sometimes', 'required', 'numeric', 'gt:0', 'max:9999.99'],
            'monthly_rent' => ['sometimes', 'required', 'numeric', 'gte:0', 'max:99999999.99'],
            'amenities' => ['sometimes', 'required', 'array'],
            'amenities.*' => ['string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', Rule::in(['unverified', 'available', 'reserved', 'occupied', 'maintenance'])],
        ]);
        if (($data['size_min_sqm'] ?? $room->size_min_sqm) > ($data['size_max_sqm'] ?? $room->size_max_sqm)) {
            return response()->json(['message' => 'The minimum room size cannot exceed the maximum.', 'errors' => ['size_min_sqm' => ['The minimum room size cannot exceed the maximum.']]], 422);
        }
        if ($room->building->slug === 'building-2' && array_key_exists('side', $data) && $data['side'] !== null) {
            return response()->json(['message' => 'Building 2 rooms do not have a recorded side.', 'errors' => ['side' => ['Building 2 rooms do not have a recorded side.']]], 422);
        }
        if (isset($data['status']) && $data['status'] !== 'occupied' && Contract::where('active_room_id', $room->id)->exists()) {
            return response()->json(['message' => 'End the active tenancy before changing this room status.', 'errors' => ['status' => ['End the active tenancy before changing this room status.']]], 422);
        }
        $room->update($data);

        return response()->json($room->load(['building', 'photos']));
    }

    public function uploadPhoto(Request $request, Room $room): JsonResponse
    {
        $request->validate(['photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);
        $file = $request->file('photo');
        $path = $file->store('room-photos/'.$room->id, 'local');
        $photo = $room->photos()->create(['path' => $path, 'original_name' => $file->getClientOriginalName()]);

        return response()->json($photo, 201);
    }

    public function photo(RoomPhoto $photo)
    {
        abort_unless(Storage::disk('local')->exists($photo->path), 404);

        return response()->file(Storage::disk('local')->path($photo->path), ['Content-Type' => Storage::disk('local')->mimeType($photo->path), 'Cache-Control' => 'private, no-store']);
    }

    public function setPhotoVisibility(Request $request, RoomPhoto $photo): JsonResponse
    {
        $data = $request->validate(['is_public' => ['required', 'boolean']]);
        if ($data['is_public'] && ! Storage::disk('local')->exists($photo->path)) {
            return response()->json(['message' => 'The photo file is missing and cannot be published.'], 422);
        }

        $photo->update([
            'is_public' => $data['is_public'],
            'approved_by' => $data['is_public'] ? $request->user()->id : null,
            'approved_at' => $data['is_public'] ? now() : null,
        ]);

        return response()->json($photo->fresh());
    }

    public function createStaff(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'owner', 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ]);
        $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password'], 'role' => 'staff']);

        return response()->json(['user' => $user->only('id', 'name', 'email', 'role')], 201);
    }
}
