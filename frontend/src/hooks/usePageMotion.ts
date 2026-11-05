import { useEffect } from 'react'

const revealSelector = [
  '.public-shell .section-intro',
  '.public-shell .building-row',
  '.public-shell .amenities-band',
  '.public-shell .rooms-head',
  '.public-shell .room-tabs',
  '.public-shell .room-card',
  '.public-shell .gallery-intro',
  '.public-shell .gallery-grid figure',
  '.public-shell .location-section',
  '.public-shell .contact-section',
  '.public-shell .public-footer',
  '.staff-dashboard > header',
  '.staff-dashboard > div > p:first-child',
  '.staff-dashboard > div > h1',
  '.staff-dashboard > div > nav',
  '.staff-dashboard > div > section',
  '.staff-dashboard > div > section article',
  '.staff-dashboard #rooms button',
  '.staff-dashboard .staff-tenancy > div:not(.fixed)',
  '.staff-dashboard #overview',
  '.staff-dashboard #payments',
  '.staff-dashboard #inspections',
].join(', ')

export function usePageMotion() {
  useEffect(() => {
    const root = document.getElementById('root')
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!root || preference.matches || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const element = entry.target as HTMLElement
        element.dataset.motion = 'visible'
        observer.unobserve(element)
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -28px 0px' })

    const tracked = new WeakSet<HTMLElement>()
    const scan = () => {
      if (preference.matches) return
      root.querySelectorAll<HTMLElement>(revealSelector).forEach(element => {
        if (!element.dataset.motion) element.dataset.motion = 'pending'
        if (element.dataset.motion !== 'pending' || tracked.has(element)) return
        tracked.add(element)
        observer.observe(element)
      })
    }
    scan()
    const changes = new MutationObserver(scan)
    changes.observe(root, { childList: true, subtree: true })
    const showAll = () => {
      if (!preference.matches) return
      observer.disconnect()
      root.querySelectorAll<HTMLElement>('[data-motion="pending"]').forEach(element => { element.dataset.motion = 'visible' })
    }
    preference.addEventListener('change', showAll)
    return () => { changes.disconnect(); observer.disconnect(); preference.removeEventListener('change', showAll) }
  }, [])
}
