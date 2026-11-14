import { request } from '../api/client'
import type { Building, Contract, DashboardSummary, Inspection, Ledger, Photo, Room, RoomForm, StaffAccount, StaffUser, Tenant, UtilityBill, UtilityMeterCharge } from '../types/staff'

export const getSession = () => request<{ user: StaffUser }>('/api/me', { signal: AbortSignal.timeout(4000) })
export const getBuildings = () => request<Building[]>('/api/buildings')
export const getRooms = () => request<Room[]>('/api/rooms')
export const getRoom = (id: number) => request<Room>(`/api/rooms/${id}`)

export const signIn = (email: string, password: string) => request<{ user: StaffUser }>('/api/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(8000),
})

export const signOut = () => request('/api/logout', { method: 'POST' })

export const saveRoom = (id: number, form: RoomForm) => request<Room>(`/api/rooms/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    floor: Number(form.floor),
    side: form.side || null,
    size_min_sqm: form.size_min_sqm,
    size_max_sqm: form.size_max_sqm,
    monthly_rent: form.monthly_rent,
    amenities: form.amenities.split(',').map(value => value.trim()).filter(Boolean),
    description: form.description || null,
    status: form.status,
  }),
})

export const uploadRoomPhoto = (id: number, file: File) => {
  const data = new FormData()
  data.append('photo', file)
  return request(`/api/rooms/${id}/photos`, { method: 'POST', body: data })
}

export const setPhotoVisibility = (photo: Photo) => request(`/api/photos/${photo.id}/visibility`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_public: !photo.is_public }),
})

export const getTenants = () => request<Tenant[]>('/api/tenants')
export const getContracts = () => request<Contract[]>('/api/contracts')
export const saveTenant = (values: Record<string, string>, id?: number) => request<Tenant>(id ? `/api/tenants/${id}` : '/api/tenants', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const createContract = (values: object) => request<Contract>('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const signContract = (id: number, values: object) => request<Contract>(`/api/contracts/${id}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const moveIn = (id: number, values: object) => request<Contract>(`/api/contracts/${id}/move-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const endTenancy = (id: number, values: object) => request<Contract>(`/api/contracts/${id}/end`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const uploadContract = (id: number, file: File) => { const data = new FormData(); data.append('file', file); return request(`/api/contracts/${id}/files`, { method: 'POST', body: data }) }
export const getContractTemplate = () => request<{ id: number; original_name: string; created_at: string } | null>('/api/contract-template')
export const uploadContractTemplate = (file: File) => { const data = new FormData(); data.append('file', file); return request<{ id: number; original_name: string; created_at: string }>('/api/contract-template', { method: 'POST', body: data }) }
export const generateContractPdf = (id: number, values: object) => request<{ id: number; original_name: string; kind: 'generated' }>(`/api/contracts/${id}/generate-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const getDashboard = (buildingId = 'all') => request<DashboardSummary>(`/api/staff/dashboard${buildingId === 'all' ? '' : `?building_id=${encodeURIComponent(buildingId)}`}`)
export const getLedgers = () => request<Record<string, Ledger>>('/api/staff/ledgers')
export const recordPayment = (contractId: number, values: object) => request(`/api/contracts/${contractId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const voidRentPayment = (contractId: number, paymentId: number, reason: string) => request(`/api/contracts/${contractId}/payments/${paymentId}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
export const addContractAdjustment = (contractId: number, values: object) => request(`/api/contracts/${contractId}/adjustments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const voidContractAdjustment = (contractId: number, adjustmentId: number, reason: string) => request(`/api/contracts/${contractId}/adjustments/${adjustmentId}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
export const getInspections = (roomId: number) => request<Inspection[]>(`/api/rooms/${roomId}/inspections`)
export const createInspection = (roomId: number, values: object) => request<Inspection>(`/api/rooms/${roomId}/inspections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const uploadInspectionPhoto = (id: number, file: File) => { const data = new FormData(); data.append('photo', file); return request(`/api/inspections/${id}/photos`, { method: 'POST', body: data }) }
export const getUtilityBills = () => request<UtilityBill[]>('/api/utility-bills')
export const getUtilityMeterCharges = () => request<UtilityMeterCharge[]>('/api/utility-meter-charges')
export const createUtilityMeterCharge = (values: object) => request<UtilityMeterCharge>('/api/utility-meter-charges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const correctUtilityMeterCharge = (id: number, values: object) => request<UtilityMeterCharge>(`/api/utility-meter-charges/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const approveUtilityMeterCharge = (id: number) => request<UtilityMeterCharge>(`/api/utility-meter-charges/${id}/approve`, { method: 'POST' })
export const createUtilityBill = (values: object) => request<UtilityBill>('/api/utility-bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const recordUtilityPayment = (billId: number, values: object) => request<UtilityBill>(`/api/utility-bills/${billId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const voidUtilityPayment = (billId: number, paymentId: number, reason: string) => request<UtilityBill>(`/api/utility-bills/${billId}/payments/${paymentId}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
export const addUtilityRefund = (billId: number, values: object) => request(`/api/utility-bills/${billId}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const voidUtilityRefund = (billId: number, refundId: number, reason: string) => request(`/api/utility-bills/${billId}/refunds/${refundId}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
export const uploadUtilityBillFile = (billId: number, file: File) => { const data = new FormData(); data.append('file', file); return request<UtilityBill>(`/api/utility-bills/${billId}/file`, { method: 'POST', body: data }) }
export const getStaffAccounts = () => request<StaffAccount[]>('/api/staff-users')
export const createStaffAccount = (values: object) => request<{ user: StaffAccount }>('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const updateStaffAccount = (id: number, values: object) => request<StaffAccount>(`/api/staff-users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
