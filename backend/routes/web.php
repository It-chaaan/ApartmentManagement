<?php

use App\Http\Controllers\ManagementController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('api')->group(function () {
    Route::get('/csrf', fn (Request $request) => response()->json(['token' => csrf_token()]));
    Route::post('/login', [ManagementController::class, 'login'])->middleware('throttle:5,1');
    Route::middleware('auth')->group(function () {
        Route::get('/me', [ManagementController::class, 'me']);
        Route::post('/logout', [ManagementController::class, 'logout']);
        Route::get('/buildings', [ManagementController::class, 'buildings']);
        Route::put('/buildings/{building}', [ManagementController::class, 'updateBuilding']);
        Route::get('/rooms', [ManagementController::class, 'rooms']);
        Route::get('/rooms/{room}', [ManagementController::class, 'room']);
        Route::put('/rooms/{room}', [ManagementController::class, 'updateRoom']);
        Route::post('/rooms/{room}/photos', [ManagementController::class, 'uploadPhoto']);
        Route::get('/photos/{photo}', [ManagementController::class, 'photo']);
        Route::post('/staff', [ManagementController::class, 'createStaff']);
    });
});
