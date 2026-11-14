<?php

namespace Database\Seeders;

use App\Models\Contract;
use App\Models\ContractFile;
use App\Models\Room;
use App\Models\RoomInspection;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UtilityBill;
use Carbon\CarbonImmutable;
use FPDF;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DemoSeeder extends Seeder
{
    private const AREAS = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'];

    public function run(): void
    {
        $database = str_replace('\\', '/', (string) config('database.connections.sqlite.database'));
        $privateRoot = str_replace('\\', '/', (string) config('filesystems.disks.local.root'));
        if (! app()->environment('demo') || config('database.default') !== 'sqlite'
            || ! str_contains($database, '/storage/framework/testing/demo-')
            || ! str_contains($privateRoot, '/storage/framework/testing/demo-')) {
            throw new RuntimeException('Demo records require the isolated demo SQLite database and private file directory.');
        }
        $password = env('DEMO_PASSWORD');
        if (! is_string($password) || strlen($password) < 12) {
            throw new RuntimeException('A temporary DEMO_PASSWORD of at least 12 characters is required.');
        }

        $this->call(DatabaseSeeder::class);
        if (User::where('email', 'demo-owner@example.test')->exists()) {
            return;
        }
        DB::transaction(fn () => $this->records($password));
    }

    private function records(string $password): void
    {
        $owner = User::create(['name' => '[DEMO] Owner', 'email' => 'demo-owner@example.test', 'password' => $password, 'role' => 'owner', 'is_active' => true]);
        User::create(['name' => '[DEMO] Staff', 'email' => 'demo-staff@example.test', 'password' => $password, 'role' => 'staff', 'is_active' => true]);
        User::create(['name' => '[DEMO] Disabled Staff', 'email' => 'demo-disabled@example.test', 'password' => $password, 'role' => 'staff', 'is_active' => false]);
        $rooms = Room::with('building')->get()->keyBy(fn (Room $room) => $room->building->slug.':'.$room->code);
        foreach (['building-1:1-A' => 'occupied', 'building-1:1-B' => 'occupied', 'building-1:1-C' => 'reserved',
            'building-1:1-D' => 'available', 'building-1:1-E' => 'maintenance', 'building-2:1' => 'unverified',
            'building-2:2' => 'available', 'building-2:3' => 'occupied'] as $key => $status) {
            $rooms[$key]->update(['status' => $status]);
        }

        $today = CarbonImmutable::today();
        $month = $today->startOfMonth();
        $a = $this->tenant('Mara Santos', '1001');
        $b = $this->tenant('Noel Reyes', '1002');
        $c = $this->tenant('Iris Cruz', '1003');
        $d = $this->tenant('Paolo Garcia', '1004');
        $e = $this->tenant('Lia Ramos', '1005');
        $f = $this->tenant('Ben Flores', '1006');

        $active = $this->contract($a, $rooms['building-1:1-A'], 'active', $month->subMonths(3), $month->addMonths(9), $owner);
        $this->signingPayments($active, $owner);
        $this->rent($active, $month->subMonths(2), '5000.00', $owner);
        $this->rent($active, $month->subMonth(), '2000.00', $owner);
        $this->rent($active, $month->subMonth(), '1500.00', $owner, true);

        $expiring = $this->contract($b, $rooms['building-1:1-B'], 'active', $month->subMonths(11), $today->addDays(20), $owner);
        $this->signingPayments($expiring, $owner);
        for ($i = 1; $i <= 9; $i++) {
            $this->rent($expiring, $month->subMonths(11 - $i), '5000.00', $owner);
        }
        $signed = $this->contract($c, $rooms['building-1:1-C'], 'signed', $today->addDays(7), $today->addYear()->addDays(7), $owner);
        $this->signingPayments($signed, $owner);

        $endedStart = $month->subMonths(4);
        $endedOn = $month->subMonth()->addDays(12);
        $ended = $this->contract($d, $rooms['building-2:1'], 'ended', $endedStart, $endedOn, $owner);
        $this->signingPayments($ended, $owner);
        for ($i = 1; $i <= 3; $i++) {
            $this->rent($ended, $endedStart->addMonths($i), $i === 3 ? '4500.00' : '4000.00', $owner);
        }
        $this->contract($e, $rooms['building-2:2'], 'draft', $today->addDays(10), $today->addYear()->addDays(10), $owner);
        $paid = $this->contract($f, $rooms['building-2:3'], 'active', $month->subMonths(2), $month->addMonths(10), $owner);
        $this->signingPayments($paid, $owner);
        $this->rent($paid, $month->subMonth(), '4000.00', $owner);
        $this->rent($paid, $month, '4000.00', $owner);

        $this->inspection($rooms['building-1:1-A'], $active, $owner, 'routine', $today->subDays(2), 'sink');
        $this->inspection($rooms['building-1:1-B'], $expiring, $owner, 'move_in', $month->subMonths(11), null);
        $moveOut = $this->inspection($rooms['building-2:1'], $ended, $owner, 'move_out', $endedOn, 'paint');
        $photoPath = 'demo/paint-check.png';
        Storage::disk('local')->put($photoPath, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='));
        $moveOut->photos()->create(['path' => $photoPath, 'original_name' => '[DEMO] paint-check.png', 'uploaded_by' => $owner->id]);
        foreach ([['rent_refund', '500.00', 'Returned sample rent overpayment', null],
            ['advance_refund', '4000.00', 'Returned unused sample advance', null],
            ['deposit_deduction', '600.00', 'Sample paint repair deduction', $moveOut->id],
            ['deposit_refund', '2000.00', 'Partial return of sample deposit', null]] as [$kind, $amount, $reason, $inspectionId]) {
            $ended->adjustments()->create(['kind' => $kind, 'amount' => $amount, 'occurred_on' => $endedOn->toDateString(),
                'method' => $kind === 'deposit_deduction' ? null : 'cash', 'reason' => '[DEMO] '.$reason,
                'inspection_id' => $inspectionId, 'approved_by' => $owner->id]);
        }

        $electricity = $this->bill($rooms['building-1:1-A'], 'electricity', $month, '850.00', $owner);
        $this->billPayment($electricity, '300.00', $owner);
        $this->billPayment($electricity, '100.00', $owner, true);
        $water = $this->bill($rooms['building-1:1-A'], 'water', $month->subMonth(), '250.00', $owner);
        $this->billPayment($water, '400.00', $owner);
        $water->refunds()->create(['amount' => '50.00', 'refunded_on' => $today->toDateString(), 'method' => 'cash',
            'reason' => '[DEMO] Partial return of sample water overpayment', 'approved_by' => $owner->id]);
        $this->bill($rooms['building-1:1-B'], 'electricity', $month->subMonth(), '920.00', $owner);
        $this->billPayment($this->bill($rooms['building-2:3'], 'water', $month, '190.00', $owner), '190.00', $owner);

        $pdf = new FPDF;
        $pdf->AddPage();
        $pdf->SetFont('Arial', 'B', 18);
        $pdf->Cell(0, 12, 'DEMO DOCUMENT - NOT A REAL BILL OR CONTRACT');
        Storage::disk('local')->put('demo/sample-document.pdf', $pdf->Output('S'));
        $electricity->update(['file_path' => 'demo/sample-document.pdf', 'file_name' => '[DEMO] sample-bill.pdf']);
        ContractFile::create(['contract_id' => $active->id, 'path' => 'demo/sample-document.pdf',
            'original_name' => '[DEMO] sample-contract.pdf', 'uploaded_by' => $owner->id, 'kind' => 'signed']);
    }

    private function tenant(string $name, string $number): Tenant
    {
        return Tenant::create(['full_name' => '[DEMO] '.$name, 'phone' => '0900-000-'.$number,
            'email' => 'tenant'.$number.'@example.test', 'contact_address' => '[DEMO] Brgy. Lingunan, Valenzuela City',
            'emergency_name' => '[DEMO] Contact '.$number, 'emergency_phone' => '0900-999-'.$number,
            'emergency_relationship' => 'Family']);
    }

    private function contract(Tenant $tenant, Room $room, string $status, CarbonImmutable $start, CarbonImmutable $end, User $owner): Contract
    {
        $rent = $room->monthly_rent;
        $signedOn = $status === 'signed' ? CarbonImmutable::today() : $start;

        return Contract::create(['tenant_id' => $tenant->id, 'room_id' => $room->id,
            'active_room_id' => $status === 'active' ? $room->id : null,
            'signed_on' => $signedOn->toDateString(), 'starts_on' => $start->toDateString(), 'ends_on' => $end->toDateString(),
            'monthly_rent' => $rent, 'due_day' => 5, 'advance_amount' => $rent, 'deposit_amount' => $rent,
            'advance_paid' => $status === 'draft' ? null : $rent, 'deposit_paid' => $status === 'draft' ? null : $rent,
            'moved_in_on' => in_array($status, ['active', 'ended'], true) ? $start->toDateString() : null,
            'ended_on' => $status === 'ended' ? $end->toDateString() : null,
            'end_review_note' => $status === 'ended' ? '[DEMO] Move-out reviewed; see sample settlement.' : null,
            'status' => $status, 'signing_recorded_at' => $status === 'draft' ? null : $signedOn,
            'signing_recorded_by' => $status === 'draft' ? null : $owner->id]);
    }

    private function signingPayments(Contract $contract, User $owner): void
    {
        foreach (['advance' => null, 'deposit' => null, 'rent' => $contract->starts_on->startOfMonth()->toDateString()] as $kind => $period) {
            $contract->payments()->create(['recorded_by' => $owner->id, 'kind' => $kind, 'period_month' => $period,
                'paid_on' => $contract->signed_on->toDateString(), 'amount' => $contract->monthly_rent,
                'method' => 'cash', 'notes' => '[DEMO] Signing payment', 'submission_key' => (string) Str::uuid()]);
        }
    }

    private function rent(Contract $contract, CarbonImmutable $month, string $amount, User $owner, bool $voided = false): void
    {
        $contract->payments()->create(['recorded_by' => $owner->id, 'kind' => 'rent',
            'period_month' => $month->startOfMonth()->toDateString(), 'paid_on' => $month->addDays(5)->toDateString(),
            'amount' => $amount, 'method' => 'gcash', 'reference' => '[DEMO] RENT',
            'notes' => '[DEMO] Sample rent payment', 'submission_key' => (string) Str::uuid(),
            'voided_at' => $voided ? now() : null, 'voided_by' => $voided ? $owner->id : null,
            'void_reason' => $voided ? '[DEMO] Recorded against wrong month' : null]);
    }

    private function inspection(Room $room, Contract $contract, User $owner, string $type, CarbonImmutable $date, ?string $repairArea): RoomInspection
    {
        $inspection = RoomInspection::create(['room_id' => $room->id, 'contract_id' => $contract->id,
            'inspected_by' => $owner->id, 'type' => $type, 'inspected_on' => $date->toDateString(),
            'notes' => '[DEMO] Sample '.$type.' checklist']);
        foreach (self::AREAS as $area) {
            $inspection->items()->create(['area' => $area, 'condition' => $area === $repairArea ? 'needs_repair' : 'good',
                'notes' => $area === $repairArea ? '[DEMO] Sample repair item' : null]);
        }

        return $inspection;
    }

    private function bill(Room $room, string $kind, CarbonImmutable $month, string $amount, User $owner): UtilityBill
    {
        return UtilityBill::create(['room_id' => $room->id, 'kind' => $kind,
            'period_month' => $month->startOfMonth()->toDateString(), 'due_on' => $month->addDays(12)->toDateString(),
            'amount' => $amount, 'account_reference' => '[DEMO] '.$kind.' '.$room->code,
            'delivered_on' => $month->addDays(2)->toDateString(), 'notes' => '[DEMO] Manually entered sample bill',
            'created_by' => $owner->id]);
    }

    private function billPayment(UtilityBill $bill, string $amount, User $owner, bool $voided = false): void
    {
        $bill->payments()->create(['recorded_by' => $owner->id, 'paid_on' => CarbonImmutable::today()->toDateString(),
            'amount' => $amount, 'method' => 'cash', 'reference' => '[DEMO] BILL',
            'notes' => '[DEMO] Sample utility payment', 'submission_key' => (string) Str::uuid(),
            'voided_at' => $voided ? now() : null, 'voided_by' => $voided ? $owner->id : null,
            'void_reason' => $voided ? '[DEMO] Duplicate sample payment' : null]);
    }
}
