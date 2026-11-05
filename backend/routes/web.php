<?php

use App\Http\Controllers\ManagementController;
use App\Http\Controllers\PublicSiteController;
use App\Http\Controllers\TenancyController;
use App\Http\Controllers\StaffOperationsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('api')->group(function () {
    Route::get('/public/site', [PublicSiteController::class, 'site']);
    Route::get('/public/photos/{photo}', [PublicSiteController::class, 'photo']);
    Route::get('/csrf', fn (Request $request) => response()->json(['token' => csrf_token()]));
    Route::post('/login', [ManagementController::class, 'login'])->middleware('throttle:5,1');
    Route::middleware(['auth', 'staff.role'])->group(function () {
        Route::get('/me', [ManagementController::class, 'me']);
        Route::get('/staff/dashboard', [StaffOperationsController::class, 'dashboard']);
        Route::get('/staff/ledgers', [StaffOperationsController::class, 'ledgers']);
        Route::post('/contracts/{contract}/payments', [StaffOperationsController::class, 'storePayment']);
        Route::get('/rooms/{room}/inspections', [StaffOperationsController::class, 'inspections']);
        Route::post('/rooms/{room}/inspections', [StaffOperationsController::class, 'storeInspection']);
        Route::post('/inspections/{inspection}/photos', [StaffOperationsController::class, 'uploadInspectionPhoto']);
        Route::get('/inspections/{inspection}/photos/{photo}', [StaffOperationsController::class, 'inspectionPhoto']);
        Route::post('/logout', [ManagementController::class, 'logout']);
        Route::get('/buildings', [ManagementController::class, 'buildings']);
        Route::put('/buildings/{building}', [ManagementController::class, 'updateBuilding']);
        Route::get('/rooms', [ManagementController::class, 'rooms']);
        Route::get('/rooms/{room}', [ManagementController::class, 'room']);
        Route::put('/rooms/{room}', [ManagementController::class, 'updateRoom']);
        Route::post('/rooms/{room}/photos', [ManagementController::class, 'uploadPhoto']);
        Route::get('/photos/{photo}', [ManagementController::class, 'photo']);
        Route::patch('/photos/{photo}/visibility', [ManagementController::class, 'setPhotoVisibility']);
        Route::post('/staff', [ManagementController::class, 'createStaff']);
        Route::get('/tenants', [TenancyController::class, 'tenants']);
        Route::post('/tenants', [TenancyController::class, 'storeTenant']);
        Route::put('/tenants/{tenant}', [TenancyController::class, 'updateTenant']);
        Route::get('/contracts', [TenancyController::class, 'contracts']);
        Route::post('/contracts', [TenancyController::class, 'storeContract']);
        Route::post('/contracts/{contract}/move-in', [TenancyController::class, 'moveIn']);
        Route::post('/contracts/{contract}/end', [TenancyController::class, 'end']);
        Route::post('/contracts/{contract}/files', [TenancyController::class, 'upload']);
        Route::get('/contracts/{contract}/files/{file}', [TenancyController::class, 'download']);
    });
});
