import type { PublicSite } from '../types/public'

export async function getPublicSite(): Promise<PublicSite> {
  const response = await fetch('/api/public/site', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Property information is temporarily unavailable. Please try again later.')
  return response.json() as Promise<PublicSite>
}
