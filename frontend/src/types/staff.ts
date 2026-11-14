export type Status = 'unverified' | 'available' | 'reserved' | 'occupied' | 'maintenance'

export type Building = {
  id: number
  name: string
  address: string
  lot_area_sqm: string
  description: string
  amenities: string[]
  rooms_count: number
}

export type Photo = { id: number; url: string; original_name: string; is_public: boolean }

export type Room = {
  id: number
  building_id: number
  building: { name: string }
  code: string
  floor: number
  side: string | null
  size_min_sqm: string
  size_max_sqm: string
  monthly_rent: string
  amenities: string[]
  description: string | null
  status: Status
  photos: Photo[]
}

export type StaffUser = { id: number; name: string; email: string; role: string }
export type StaffAccount = { id: number; name: string; email: string; role: 'owner' | 'staff'; is_active: boolean; created_at: string }
export type UtilityBillPayment = { id: number; paid_on: string; amount: string; method: string; reference: string | null; notes: string | null; recorder: { name: string }; voided_at: string | null; void_reason: string | null; voider: { name: string } | null }
export type UtilityBillRefund = { id: number; amount: string; refunded_on: string; method: string; reference: string | null; reason: string; approver: { name: string }; voided_at: string | null; void_reason: string | null; voider: { name: string } | null }
export type UtilityBill = {
  id: number; room_id: number; room: { code: string; building_id: number; building: { name: string } }
  kind: 'electricity' | 'water'; period_month: string; due_on: string; amount: string
  paid_amount: string; balance: string; credit_available: string; refunded_amount: string; status: 'paid' | 'partial' | 'overdue' | 'unpaid' | 'overpaid'
  account_reference: string | null; delivered_on: string | null; notes: string | null
  file_name: string | null; payments: UtilityBillPayment[]; refunds: UtilityBillRefund[]
}

export type RoomForm = {
  floor: string
  side: string
  size_min_sqm: string
  size_max_sqm: string
  monthly_rent: string
  amenities: string
  description: string
  status: Status
}

export type Tenant = {
  id: number; full_name: string; phone: string | null; email: string | null; contact_address: string | null
  emergency_name: string | null; emergency_phone: string | null; emergency_relationship: string | null
  contracts: Contract[]
}

export type ContractFile = { id: number; original_name: string; kind: 'signed' | 'generated'; created_at: string }
export type Contract = {
  id: number; tenant_id: number; room_id: number; previous_contract_id: number | null
  tenant: Tenant; room: Room; previous_contract?: Contract | null; files: ContractFile[]
  signed_on: string; starts_on: string; ends_on: string; monthly_rent: string; due_day: number
  advance_amount: string; deposit_amount: string; advance_paid: string | null; deposit_paid: string | null
  signing_recorded_at: string | null; pdf_fields: Record<string, string> | null
  moved_in_on: string | null; ended_on: string | null; end_review_note: string | null
  status: 'draft' | 'signed' | 'active' | 'ended' | 'renewed'
}

export type Installment = { period_month: string; due_on: string; amount: string; paid: string; advance_applied: string; balance: string; is_due: boolean }
export type Payment = { id: number; kind: 'rent' | 'advance' | 'deposit' | 'rent_transfer_out' | 'advance_transfer_out' | 'deposit_transfer_out'; period_month: string | null; paid_on: string; amount: string; method: string; reference: string | null; notes: string | null; recorder: { name: string } | null; voided_at: string | null; void_reason: string | null; voider?: { name: string } | null }
export type ContractAdjustment = { id: number; kind: 'rent_refund' | 'advance_refund' | 'deposit_refund' | 'deposit_deduction'; amount: string; occurred_on: string; method: string | null; reference: string | null; reason: string; inspection_id: number | null; approver: { name: string }; voided_at: string | null; void_reason: string | null; voider: { name: string } | null }
export type Ledger = { contract_id: number; installments: Installment[]; due_balance: string; advance_paid: string; advance_applied: string; advance_remaining: string; deposit_paid: string; rent_credit: string; advance_refundable: string; deposit_refundable: string; deposit_deducted: string; payments: Payment[]; adjustments: ContractAdjustment[] }
export type DashboardSummary = { room_count: number; statuses: Record<string, number>; active_tenancies: number; rent_due: number; upcoming: (Installment & { contract_id: number; tenant: string; room: string })[]; expiring_contracts: { contract_id: number; tenant: string; room: string; ends_on: string }[]; repair_checklists: { room_id: number; room: string; inspected_on: string; areas: string[] }[]; unverified_rooms: { room_id: number; room: string }[] }
export type InspectionItem = { area: string; condition: 'good' | 'needs_repair' | 'not_checked'; notes: string | null }
export type Inspection = { id: number; room_id: number; contract_id: number | null; type: 'move_in' | 'routine' | 'move_out'; inspected_on: string; notes: string | null; inspector: { name: string }; items: InspectionItem[]; photos: { id: number; original_name: string }[] }
