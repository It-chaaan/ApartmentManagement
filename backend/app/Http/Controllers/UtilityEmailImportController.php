<?php

namespace App\Http\Controllers;

use App\Models\UtilityBill;
use App\Models\UtilityEmailImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UtilityEmailImportController extends Controller
{
    public function index(): JsonResponse
    {
        $imports = UtilityEmailImport::with(['room', 'importer', 'reviewer'])->orderByDesc('id')->limit(200)->get();

        return response()->json($imports->map(fn (UtilityEmailImport $import): array => $this->data($import)))->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'kind' => ['required', Rule::in(['electricity', 'water'])],
            'period_month' => ['required', 'date_format:Y-m'],
            'due_on' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'sender_address' => ['required', 'email', 'max:255'],
            'message_id' => ['nullable', 'string', 'max:255'],
            'received_on' => ['required', 'date_format:Y-m-d'],
            'account_reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);
        $file = $request->file('file');
        $hash = hash_file('sha256', $file->getRealPath());
        $month = $data['period_month'].'-01';
        $conflict = UtilityEmailImport::where('status', '!=', 'rejected')
            ->where(function ($query) use ($data, $hash, $month): void {
                $query->where(function ($query) use ($data, $month): void {
                    $query->where('room_id', $data['room_id'])->where('kind', $data['kind'])->whereDate('period_month', $month);
                })->orWhere(function ($query) use ($data): void {
                    if ($data['message_id'] ?? null) {
                        $query->where('sender_address', $data['sender_address'])->where('message_id', $data['message_id']);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                })->orWhere('file_sha256', $hash);
            })->exists();
        $existingBill = UtilityBill::where('room_id', $data['room_id'])->where('kind', $data['kind'])->whereDate('period_month', $month)->exists();
        $path = $file->store('utility-email-imports', 'local');
        $import = UtilityEmailImport::create([
            ...collect($data)->except('file')->all(),
            'period_month' => $month,
            'file_path' => $path, 'file_name' => $file->getClientOriginalName(), 'file_sha256' => $hash,
            'status' => $conflict || $existingBill ? 'exception' : 'pending',
            'exception_reason' => $conflict || $existingBill ? 'Possible duplicate message, attachment, or room and billing month. Review before rejecting or importing again.' : null,
            'imported_by' => $request->user()->id,
        ]);

        return response()->json($this->data($import->load(['room', 'importer', 'reviewer'])), 201)->header('Cache-Control', 'private, no-store');
    }

    public function approve(Request $request, UtilityEmailImport $import): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $import): UtilityEmailImport {
            $import = UtilityEmailImport::whereKey($import->id)->lockForUpdate()->firstOrFail();
            if ($import->status !== 'pending') {
                throw ValidationException::withMessages(['import' => 'Only a pending import can be approved.']);
            }
            if (UtilityBill::where('room_id', $import->room_id)->where('kind', $import->kind)->whereDate('period_month', $import->period_month)->exists()) {
                $import->update(['status' => 'exception', 'exception_reason' => 'A bill already exists for this room, utility, and month.']);

                return $import;
            }
            $bill = UtilityBill::create([
                'room_id' => $import->room_id, 'kind' => $import->kind, 'period_month' => $import->period_month,
                'due_on' => $import->due_on, 'amount' => $import->amount, 'account_reference' => $import->account_reference,
                'delivered_on' => $import->received_on, 'notes' => $import->notes,
                'created_by' => $request->user()->id,
            ]);
            $billPath = 'utility-bills/'.$bill->id.'/import-'.Str::random(20).'.pdf';
            if (! Storage::disk('local')->copy($import->file_path, $billPath)) {
                throw ValidationException::withMessages(['file' => 'The private attachment could not be copied.']);
            }
            $bill->update(['file_path' => $billPath, 'file_name' => $import->file_name]);
            $import->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'utility_bill_id' => $bill->id]);

            return $import;
        });

        return response()->json($this->data($result->load(['room', 'importer', 'reviewer'])), $result->status === 'exception' ? 409 : 200)->header('Cache-Control', 'private, no-store');
    }

    public function reject(Request $request, UtilityEmailImport $import): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        $import = DB::transaction(function () use ($request, $import, $data): UtilityEmailImport {
            $import = UtilityEmailImport::whereKey($import->id)->lockForUpdate()->firstOrFail();
            if (! in_array($import->status, ['pending', 'exception'], true)) {
                throw ValidationException::withMessages(['import' => 'This import has already been reviewed.']);
            }
            $import->update(['status' => 'rejected', 'review_reason' => $data['reason'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

            return $import;
        });

        return response()->json($this->data($import->load(['room', 'importer', 'reviewer'])))->header('Cache-Control', 'private, no-store');
    }

    public function download(UtilityEmailImport $import): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($import->file_path), 404);

        return Storage::disk('local')->download($import->file_path, $import->file_name, [
            'Content-Type' => 'application/pdf', 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function data(UtilityEmailImport $import): array
    {
        return [
            'id' => $import->id, 'room_id' => $import->room_id,
            'room' => ['code' => $import->room->code, 'building' => $import->room->building->name],
            'kind' => $import->kind, 'period_month' => $import->period_month->format('Y-m'),
            'due_on' => $import->due_on->format('Y-m-d'), 'amount' => $import->amount,
            'sender_address' => $import->sender_address, 'message_id' => $import->message_id,
            'received_on' => $import->received_on->format('Y-m-d'),
            'account_reference' => $import->account_reference, 'notes' => $import->notes,
            'file_name' => $import->file_name, 'status' => $import->status,
            'exception_reason' => $import->exception_reason, 'review_reason' => $import->review_reason,
            'imported_by' => $import->importer?->name, 'reviewed_by' => $import->reviewer?->name,
            'reviewed_at' => $import->reviewed_at?->toIso8601String(), 'utility_bill_id' => $import->utility_bill_id,
        ];
    }
}
