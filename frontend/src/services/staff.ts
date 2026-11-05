import { request } from '../api/client'
import type { Building, Contract, DashboardSummary, Inspection, Ledger, Photo, Room, RoomForm, StaffUser, Tenant } from '../types/staff'

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
export const moveIn = (id: number, values: object) => request<Contract>(`/api/contracts/${id}/move-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const endTenancy = (id: number, values: object) => request<Contract>(`/api/contracts/${id}/end`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const uploadContract = (id: number, file: File) => { const data = new FormData(); data.append('file', file); return request(`/api/contracts/${id}/files`, { method: 'POST', body: data }) }
export const getDashboard = () => request<DashboardSummary>('/api/staff/dashboard')
export const getLedgers = () => request<Record<string, Ledger>>('/api/staff/ledgers')
export const recordPayment = (contractId: number, values: object) => request(`/api/contracts/${contractId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const getInspections = (roomId: number) => request<Inspection[]>(`/api/rooms/${roomId}/inspections`)
export const createInspection = (roomId: number, values: object) => request<Inspection>(`/api/rooms/${roomId}/inspections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
export const uploadInspectionPhoto = (id: number, file: File) => { const data = new FormData(); data.append('photo', file); return request(`/api/inspections/${id}/photos`, { method: 'POST', body: data }) }
