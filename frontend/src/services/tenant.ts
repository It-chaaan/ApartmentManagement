import { request } from '../api/client'

export type TenantSession = { user: { name: string; email: string } }
export type TenantContract = {
  id: number; status: string; room: { code: string; building: string }
  starts_on: string; ends_on: string; monthly_rent: string; advance_amount: string; deposit_amount: string
  payments: { kind: string; period_month: string | null; paid_on: string; amount: string }[]
}

export const getTenantSession = () => request<TenantSession>('/api/tenant/me')
export const getTenantContracts = () => request<TenantContract[]>('/api/tenant/contracts')
export const signInTenant = (email: string, password: string) => request<TenantSession>('/api/tenant/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
export const activateTenant = (token: string, password: string) => request<TenantSession>('/api/tenant/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, password_confirmation: password }) })
export const signOutTenant = () => request('/api/tenant/logout', { method: 'POST' })
