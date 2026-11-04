import { useEffect, useState } from 'react'
import { getPublicSite } from '../services/publicSite'
import type { PublicSite } from '../types/public'

export function usePublicSite() {
  const [site, setSite] = useState<PublicSite | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicSite().then(setSite).catch(error => setError((error as Error).message))
  }, [])

  return { site, error }
}
