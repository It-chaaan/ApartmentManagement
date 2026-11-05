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

export type StaffUser = { name: string; email: string; role: string }

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

export type ContractFile = { id: number; original_name: string; created_at: string }
export type Contract = {
  id: number; tenant_id: number; room_id: number; previous_contract_id: number | null
  tenant: Tenant; room: Room; previous_contract?: Contract | null; files: ContractFile[]
  signed_on: string; starts_on: string; ends_on: string; monthly_rent: string; due_day: number
  advance_amount: string; deposit_amount: string; advance_paid: string | null; deposit_paid: string | null
  moved_in_on: string | null; ended_on: string | null; end_review_note: string | null
  status: 'draft' | 'active' | 'ended' | 'renewed'
}

export type Installment = { period_month: string; due_on: string; amount: string; paid: string; advance_applied: string; balance: string; is_due: boolean }
export type Payment = { id: number; kind: 'rent' | 'advance' | 'deposit'; period_month: string | null; paid_on: string; amount: string; method: string; reference: string | null; notes: string | null; recorder: { name: string } | null }
export type Ledger = { contract_id: number; installments: Installment[]; due_balance: string; advance_paid: string; advance_applied: string; advance_remaining: string; deposit_paid: string; payments: Payment[] }
export type DashboardSummary = { room_count: number; statuses: Record<string, number>; active_tenancies: number; rent_due: number; upcoming: (Installment & { contract_id: number; tenant: string; room: string })[] }
export type InspectionItem = { area: string; condition: 'good' | 'needs_repair' | 'not_checked'; notes: string | null }
export type Inspection = { id: number; room_id: number; contract_id: number | null; type: 'move_in' | 'routine' | 'move_out'; inspected_on: string; notes: string | null; inspector: { name: string }; items: InspectionItem[]; photos: { id: number; original_name: string }[] }
