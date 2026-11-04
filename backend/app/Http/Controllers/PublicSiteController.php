<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\RoomPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class PublicSiteController extends Controller
{
    public function site(): JsonResponse
    {
        $buildings = Building::query()
            ->whereIn('slug', ['building-1', 'building-2'])
            ->with(['rooms' => fn ($query) => $query->orderBy('floor')->orderBy('code'), 'rooms.photos' => fn ($query) => $query->where('is_public', true)->orderBy('id')])
            ->orderBy('id')
            ->get()
            ->map(fn (Building $building) => [
                'slug' => $building->slug,
                'name' => $building->name,
                'address' => $building->address,
                'lot_area_sqm' => $building->lot_area_sqm,
                'room_count' => $building->rooms->count(),
                'amenities' => $building->amenities,
                'rooms' => $building->rooms->map(fn ($room) => [
                    'code' => $room->code,
                    'floor' => $room->floor,
                    'side' => $room->side,
                    'size_min_sqm' => $room->size_min_sqm,
                    'size_max_sqm' => $room->size_max_sqm,
                    'monthly_rent' => $room->monthly_rent,
                    'availability' => $room->status === 'available' ? 'available' : 'ask',
                    'photos' => $room->photos->map(fn (RoomPhoto $photo) => [
                        'url' => '/api/public/photos/'.$photo->id,
                        'building' => $building->name,
                        'room' => $room->code,
                    ])->values(),
                ])->values(),
            ])->values();

        return response()->json(['buildings' => $buildings]);
    }

    public function photo(RoomPhoto $photo)
    {
        abort_unless($photo->is_public && Storage::disk('local')->exists($photo->path), 404);

        return response()->file(Storage::disk('local')->path($photo->path), [
            'Content-Type' => Storage::disk('local')->mimeType($photo->path),
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
