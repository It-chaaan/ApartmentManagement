<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\RoomInspection;
use InvalidArgumentException;
use RuntimeException;
use setasign\Fpdi\Fpdi;

class ContractPdfGenerator
{
    /** @param array<string, string|null> $fields */
    public function generate(string $templatePath, Contract $contract, array $fields, RoomInspection $inspection): string
    {
        $pdf = new Fpdi('P', 'pt');
        if ($pdf->setSourceFile($templatePath) !== 4) {
            throw new RuntimeException('The contract template must have four pages.');
        }

        for ($page = 1; $page <= 4; $page++) {
            $template = $pdf->importPage($page);
            $size = $pdf->getTemplateSize($template);
            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($template);
            $pdf->SetTextColor(11, 31, 58);
            $pdf->SetDrawColor(11, 31, 58);

            if ($page === 1) {
                $this->blank($pdf, 305, 507, 191, $contract->room->code, 31, 34);
            } elseif ($page === 2) {
                $this->blank($pdf, 81, 101, 207, $fields['gentleman_name'] ?? '', 12);
                $this->blank($pdf, 378, 101, 193, $fields['lady_name'] ?? '', 12);
                $this->blank($pdf, 102, 115, 53, number_format((float) $contract->monthly_rent, 0), 12);
                $this->blank($pdf, 327, 115, 60, number_format((float) $contract->deposit_amount, 0), 12);
                $this->blank($pdf, 503, 115, 67, number_format((float) $contract->advance_amount, 0), 12);
                $this->blank($pdf, 307, 307, 253, $fields['electric_account_no'] ?? '', 12);
                $this->blank($pdf, 300, 419, 177, (string) $contract->due_day, 12);
            } elseif ($page === 3) {
                $this->blank($pdf, 426, 87, 147, $contract->starts_on->format('F j, Y'), 12);
                $this->blank($pdf, 103, 101, 200, $contract->ends_on->format('F j, Y'), 12);
                $this->blank($pdf, 131, 434, 167, $fields['gentleman_name'] ?? '', 12);
                $this->blank($pdf, 356, 434, 147, $fields['lady_name'] ?? '', 12);
                $this->blank($pdf, 106, 477, 73, $fields['valid_id'] ?? '', 12);
                $this->blank($pdf, 277, 477, 153, $fields['id_place_issued'] ?? '', 12);
                $this->blank($pdf, 504, 477, 67, $fields['id_date_issued'] ?? '', 12);
            } else {
                $conditions = $inspection->items->pluck('condition', 'area');
                foreach (['paint', 'doors', 'windows', 'bathroom_fixtures', 'lights', 'tiles', 'sink'] as $index => $area) {
                    $this->markCondition($pdf, 34, [121, 165, 207, 249, 291, 334, 376][$index], $conditions->get($area));
                }
                $this->blank($pdf, 129, 568, 120, $fields['water_deposit'] ?? '', 12);
                $this->blank($pdf, 157, 589, 94, $fields['electric_deposit'] ?? '', 12);
                $this->blank($pdf, 127, 646, 126, $fields['tenant_phone'] ?? '', 12);
            }
        }

        return $pdf->Output('S');
    }

    private function blank(Fpdi $pdf, float $x, float $top, float $width, string $value, float $height, float $font = 9): void
    {
        if ($value === '') {
            return;
        }
        $pdf->SetFillColor(255, 255, 255);
        $pdf->Rect($x, $top, $width, $height, 'F');
        $pdf->Line($x, $top + $height - 1, $x + $width, $top + $height - 1);
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT', $value) ?: '';
        for ($size = $font; $size >= 6; $size -= 0.5) {
            $pdf->SetFont('Helvetica', '', $size);
            if ($pdf->GetStringWidth($encoded) <= $width - 4) {
                break;
            }
        }
        if ($pdf->GetStringWidth($encoded) > $width - 4) {
            throw new InvalidArgumentException('A value is too long for its space in the contract PDF. Shorten that field and try again.');
        }
        $pdf->Text($x + 2, $top + $height - 3, $encoded);
    }

    private function markCondition(Fpdi $pdf, float $x, float $y, ?string $condition): void
    {
        if ($condition === 'good') {
            $pdf->SetLineWidth(1.6);
            $pdf->Line($x + 11, $y + 10, $x + 16, $y + 15);
            $pdf->Line($x + 16, $y + 15, $x + 27, $y + 4);
        } elseif ($condition === 'needs_repair') {
            $pdf->SetLineWidth(1.6);
            $pdf->Line($x + 12, $y + 5, $x + 26, $y + 15);
            $pdf->Line($x + 26, $y + 5, $x + 12, $y + 15);
        }
        $pdf->SetLineWidth(0.2);
    }
}
