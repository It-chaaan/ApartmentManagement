<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\ContractTemplate;
use App\Models\RoomInspection;
use App\Services\ContractPdfGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use setasign\Fpdi\Fpdi;
use Throwable;

class ContractDocumentController extends Controller
{
    public function template(): JsonResponse
    {
        $template = ContractTemplate::latest('id')->first();

        return response()->json($template?->only('id', 'original_name', 'created_at'));
    }

    public function uploadTemplate(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'owner', 403);
        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:10240']]);
        $file = $request->file('file');
        $probe = new Fpdi('P', 'pt');
        try {
            $pages = $probe->setSourceFile($file->getRealPath());
        } catch (Throwable) {
            throw ValidationException::withMessages(['file' => 'Choose a readable four-page contract PDF.']);
        }
        if ($pages !== 4) {
            throw ValidationException::withMessages(['file' => 'The contract PDF must have four pages.']);
        }
        $path = $file->store('contract-templates', 'local');
        $template = ContractTemplate::create(['path' => $path, 'original_name' => $file->getClientOriginalName(), 'uploaded_by' => $request->user()->id]);

        return response()->json($template->only('id', 'original_name', 'created_at'), 201);
    }

    public function generate(Request $request, Contract $contract, ContractPdfGenerator $generator): JsonResponse
    {
        $fields = $request->validate([
            'gentleman_name' => ['nullable', 'string', 'max:100'],
            'lady_name' => ['nullable', 'string', 'max:100'],
            'valid_id' => ['nullable', 'string', 'max:60'],
            'id_place_issued' => ['nullable', 'string', 'max:100'],
            'id_date_issued' => ['nullable', 'string', 'max:30'],
            'electric_account_no' => ['nullable', 'string', 'max:100'],
            'water_deposit' => ['nullable', 'string', 'max:40'],
            'electric_deposit' => ['nullable', 'string', 'max:40'],
            'tenant_phone' => ['nullable', 'string', 'max:40'],
        ]);
        if (blank($fields['gentleman_name'] ?? null) && blank($fields['lady_name'] ?? null)) {
            throw ValidationException::withMessages(['gentleman_name' => 'Enter at least one tenant signer.']);
        }
        $primaryName = Str::lower(Str::squish($contract->tenant->full_name));
        $signers = [Str::lower(Str::squish($fields['gentleman_name'] ?? '')), Str::lower(Str::squish($fields['lady_name'] ?? ''))];
        if (! in_array($primaryName, $signers, true)) {
            throw ValidationException::withMessages(['gentleman_name' => 'One signer must match the tenant profile name.']);
        }
        $template = ContractTemplate::latest('id')->first();
        if (! $template || ! Storage::disk('local')->exists($template->path)) {
            throw ValidationException::withMessages(['template' => 'Upload the contract template first.']);
        }
        $inspection = RoomInspection::with('items')->where('contract_id', $contract->id)->where('type', 'move_in')->latest('inspected_on')->latest('id')->first();
        if (! $inspection) {
            throw ValidationException::withMessages(['inspection' => 'Record a move-in checklist for this contract before generating the PDF.']);
        }
        $contract->load('room');
        try {
            $bytes = $generator->generate(Storage::disk('local')->path($template->path), $contract, $fields, $inspection);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['pdf_fields' => $exception->getMessage()]);
        }
        $path = 'generated-contracts/'.$contract->id.'/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, $bytes);
        $contract->update(['pdf_fields' => $fields]);
        $file = $contract->files()->create(['path' => $path, 'original_name' => 'Guillermo-Apartment-Contract-'.$contract->id.'.pdf', 'kind' => 'generated', 'uploaded_by' => $request->user()->id]);

        return response()->json($file, 201);
    }
}
