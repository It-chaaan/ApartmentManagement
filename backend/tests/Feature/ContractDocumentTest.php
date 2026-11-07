<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\Room;
use App\Models\RoomInspection;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

class ContractDocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_uploads_private_template_and_staff_generates_from_move_in_checklist(): void
    {
        Storage::fake('local');
        $this->seed();
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'long-secret-password', 'role' => 'owner']);
        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']);
        $room = Room::firstOrFail();
        $tenant = Tenant::create(['full_name' => 'Sample Tenant', 'phone' => '09170000000']);
        $contract = Contract::create([
            'tenant_id' => $tenant->id, 'room_id' => $room->id,
            'signed_on' => '2026-11-07', 'starts_on' => '2026-11-08', 'ends_on' => '2027-11-08',
            'monthly_rent' => '5000.00', 'due_day' => 8, 'advance_amount' => '5000.00', 'deposit_amount' => '5000.00',
            'status' => 'draft',
        ]);
        $inspection = RoomInspection::create(['room_id' => $room->id, 'contract_id' => $contract->id, 'inspected_by' => $staff->id, 'type' => 'move_in', 'inspected_on' => '2026-11-07']);
        $inspection->items()->createMany(collect(['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'])->map(fn ($area) => ['area' => $area, 'condition' => $area === 'doors' ? 'needs_repair' : 'good'])->all());

        $pdf = new Fpdi('P', 'pt');
        for ($page = 0; $page < 4; $page++) {
            $pdf->AddPage('P', [612, 792]);
        }
        $template = UploadedFile::fake()->createWithContent('agreement.pdf', $pdf->Output('S'));
        $this->actingAs($staff)->post('/api/contract-template', ['file' => $template])->assertForbidden();
        $this->actingAs($owner)->post('/api/contract-template', ['file' => $template])->assertCreated()->assertJsonPath('original_name', 'agreement.pdf');
        $this->actingAs($staff)->postJson('/api/contracts/'.$contract->id.'/generate-pdf', ['gentleman_name' => 'Sample Tenant'])->assertCreated()->assertJsonPath('kind', 'generated');
        $this->postJson('/api/contracts/'.$contract->id.'/generate-pdf', ['lady_name' => 'Sample Tenant'])->assertCreated()->assertJsonPath('kind', 'generated');
        $this->assertSame('Sample Tenant', $contract->fresh()->pdf_fields['lady_name']);
        $this->assertStringNotContainsString('Sample Tenant', DB::table('contracts')->where('id', $contract->id)->value('pdf_fields'));
        $this->postJson('/api/contracts/'.$contract->id.'/generate-pdf', ['gentleman_name' => 'Different Person'])->assertUnprocessable()->assertJsonValidationErrors('gentleman_name');
        $file = $contract->fresh()->files()->firstOrFail();
        Storage::disk('local')->assertExists($file->path);
        $generated = new Fpdi('P', 'pt');
        $this->assertSame(4, $generated->setSourceFile(Storage::disk('local')->path($file->path)));
        $tenant->update(['full_name' => str_repeat('W', 100)]);
        $this->postJson('/api/contracts/'.$contract->id.'/generate-pdf', ['gentleman_name' => str_repeat('W', 100)])->assertUnprocessable()->assertJsonValidationErrors('pdf_fields');
        $this->assertDatabaseCount('contract_files', 2);
        $this->get('/api/contracts/'.$contract->id.'/files/'.$file->id)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        auth()->logout();
        $this->getJson('/api/contracts/'.$contract->id.'/files/'.$file->id)->assertUnauthorized();
    }

    public function test_generator_requires_template_inspection_and_signer(): void
    {
        $this->seed();
        $this->getJson('/api/contract-template')->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'long-secret-password', 'role' => 'staff']));
        $contract = Contract::create([
            'tenant_id' => Tenant::create(['full_name' => 'Tenant'])->id, 'room_id' => Room::firstOrFail()->id,
            'signed_on' => '2026-11-07', 'starts_on' => '2026-11-08', 'ends_on' => '2027-11-08',
            'monthly_rent' => '5000.00', 'due_day' => 8, 'advance_amount' => '5000.00', 'deposit_amount' => '5000.00',
            'status' => 'draft',
        ]);
        $this->postJson('/api/contracts/'.$contract->id.'/generate-pdf', [])->assertUnprocessable()->assertJsonValidationErrors('gentleman_name');
        $this->postJson('/api/contracts/'.$contract->id.'/generate-pdf', ['lady_name' => 'Tenant'])->assertUnprocessable()->assertJsonValidationErrors('template');
    }
}
