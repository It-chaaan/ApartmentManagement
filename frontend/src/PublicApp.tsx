import { useEffect, useState } from 'react'
import './public.css'

type PublicPhoto = { url: string; building: string; room: string }
type PublicRoom = { code: string; floor: number; side: string | null; size_min_sqm: string; size_max_sqm: string; monthly_rent: string; availability: 'available' | 'ask'; photos: PublicPhoto[] }
type PublicBuilding = { slug: string; name: string; address: string; lot_area_sqm: string; room_count: number; amenities: string[]; rooms: PublicRoom[] }
type PublicSite = { buildings: PublicBuilding[] }

const messenger = 'https://www.facebook.com/christian.guillermo.146'
const peso = (value: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(value))
const roomSize = (room: PublicRoom) => room.size_min_sqm === room.size_max_sqm
  ? `${Number(room.size_min_sqm)} sqm`
  : `Approx. ${Number(room.size_min_sqm)}–${Number(room.size_max_sqm)} sqm`
const floorName = (floor: number) => floor === 1 ? 'First floor' : 'Second floor'
const buildingSize = (building: PublicBuilding) => {
  if (!building.rooms.length) return '—'
  const min = Math.min(...building.rooms.map(room => Number(room.size_min_sqm)))
  const max = Math.max(...building.rooms.map(room => Number(room.size_max_sqm)))
  return min === max ? `${min} sqm` : `Approx. ${min}–${max} sqm`
}
const buildingRent = (building: PublicBuilding) => {
  if (!building.rooms.length) return '—'
  const rents = building.rooms.map(room => Number(room.monthly_rent))
  const min = Math.min(...rents)
  const max = Math.max(...rents)
  return min === max ? peso(String(min)) : `${peso(String(min))}–${peso(String(max))}`
}

function PublicApp() {
  const [site, setSite] = useState<PublicSite | null>(null)
  const [error, setError] = useState('')
  const [activeBuilding, setActiveBuilding] = useState('building-1')

  useEffect(() => {
    fetch('/api/public/site', { headers: { Accept: 'application/json' } })
      .then(async response => { if (!response.ok) throw new Error('Property information is temporarily unavailable. Please try again later.'); return response.json() as Promise<PublicSite> })
      .then(setSite)
      .catch(e => setError((e as Error).message))
  }, [])

  const buildings = site?.buildings ?? []
  const selected = buildings.find(building => building.slug === activeBuilding) ?? buildings[0]
  const photos = buildings.flatMap(building => building.rooms.flatMap(room => room.photos))
  const leadPhoto = photos[0]

  return <div className="public-shell" id="top">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="public-canvas">
      <header className="public-header">
        <a className="public-brand" href="#top" aria-label="Guillermo Apartment, back to top"><img src="/brand-mark.svg" alt=""/><span>Guillermo<br/>Apartment</span></a>
        <nav className="public-nav" aria-label="Main navigation"><a href="#buildings">Buildings</a><a href="#rooms">Rooms</a><a href="#location">Location</a></nav>
        <a className="nav-action" href={messenger} target="_blank" rel="noopener noreferrer">Inquire <span aria-hidden="true">↗</span></a>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-topline"><span className="eyebrow"><span className="eyebrow-dot"/> Brgy. Lingunan, Valenzuela City</span><span className="hero-index">01 / A place to begin</span></div>
          <div className="hero-heading-row"><h1 id="hero-title">LIVE IN<br/><em>LINGUNAN.</em></h1><div className="hero-aside"><span className="aside-rule" aria-hidden="true"/><p>12 rooms in Building 1. Six in Building 2. Both in Brgy. Lingunan.</p><a href="#buildings" className="text-link">Explore the buildings <span aria-hidden="true">↗</span></a></div></div>
          <div className={`hero-feature ${leadPhoto ? 'has-photo' : ''}`}>
            {leadPhoto ? <img src={leadPhoto.url} alt={`Approved apartment photo of ${leadPhoto.building}, room ${leadPhoto.room}`}/> : <div className="feature-facts"><div className="feature-kicker">Guillermo Apartment <span>Valenzuela City</span></div><div className="feature-main"><span>Two buildings.<br/>Eighteen rooms.</span><span className="feature-disc" aria-hidden="true"><span>GA</span></span></div><div className="feature-foot"><span>Furnished rooms</span><span>Individual water & electricity meters</span><span>Motorcycle parking</span></div></div>}
          </div>
          <div className="hero-bottom"><span>Find your fit in Lingunan.</span><span>Explore below <span aria-hidden="true">↓</span></span></div>
        </section>

        <section className="public-section building-section" id="buildings" aria-labelledby="building-heading">
          <div className="section-intro"><span className="section-number">01 / THE BUILDINGS</span><h2 id="building-heading">A closer look at<br/><em>each building.</em></h2><p>Two options within Guillermo Apartment, each with furnished rooms and individual water and electricity meters.</p></div>
          <div className="building-list">{buildings.map((building, index) => <article className="building-row" key={building.slug}>
            <div className="building-ident"><span className="building-num">0{index + 1}</span><h3>{building.name}</h3><p>{building.address}</p></div>
            <div className="building-specs"><div><strong>{building.room_count}</strong><span>rooms</span></div><div><strong>{buildingSize(building)}</strong><span>room size</span></div><div><strong>{buildingRent(building)}</strong><span>monthly rent per room</span></div><div><strong>{Number(building.lot_area_sqm)} sqm</strong><span>lot area</span></div></div>
            <div className="building-footer"><p>{building.slug === 'building-2' ? 'About half of the first floor is motorcycle parking. Rooms 1–2 are on the first floor; rooms 3–6 are above.' : 'Six rooms on each floor, with right and left side layouts.'}</p><a href="#rooms" onClick={() => setActiveBuilding(building.slug)} className="round-link" aria-label={`See ${building.name} rooms`}>↗</a></div>
          </article>)}</div>
          {error && <p className="public-error" role="alert">{error}</p>}
          {!site && !error && <p className="public-loading" role="status">Loading building details…</p>}
        </section>

        <section className="amenities-band" aria-labelledby="amenities-heading"><div><span className="section-number">02 / EVERYDAY ESSENTIALS</span><h2 id="amenities-heading">Details that<br/><em>make a difference.</em></h2></div><ul><li><span>01</span> Furnished rooms</li><li><span>02</span> Motorcycle parking</li><li><span>03</span> Individual water meters</li><li><span>04</span> Individual electricity meters</li></ul></section>

        <section className="public-section rooms-section" id="rooms" aria-labelledby="rooms-heading"><div className="rooms-head"><div><span className="section-number">03 / THE ROOMS</span><h2 id="rooms-heading">Find a room<br/><em>that fits.</em></h2></div><p>Browse the room layout and ask us directly about current availability. Only rooms confirmed as available are labeled available here.</p></div>
          {buildings.length > 0 && <><div className="room-tabs" role="group" aria-label="Choose a building">{buildings.map(building => <button key={building.slug} type="button" className={selected?.slug === building.slug ? 'active' : ''} onClick={() => setActiveBuilding(building.slug)} aria-pressed={selected?.slug === building.slug}>{building.name} <span>{building.room_count} rooms</span></button>)}</div><div className="room-grid">{selected?.rooms.map(room => <article className="room-card" key={room.code}><div className="room-card-top"><span>{floorName(room.floor)}{room.side ? ` · ${room.side} side` : ''}</span><span className={room.availability === 'available' ? 'room-available' : 'room-ask'}>{room.availability === 'available' ? 'Available' : 'Ask for availability'}</span></div><h3>Room {room.code}</h3><div className="room-card-bottom"><span>{roomSize(room)}</span><strong>{peso(room.monthly_rent)}<small> / month</small></strong></div></article>)}</div></>}
          <a className="inline-inquiry" href={messenger} target="_blank" rel="noopener noreferrer">Ask about a room on Messenger <span aria-hidden="true">↗</span></a>
        </section>

        <section className="public-section gallery-section" id="gallery" aria-labelledby="gallery-heading"><div className="gallery-intro"><div><span className="section-number">04 / THE SPACE</span><h2 id="gallery-heading">{photos.length ? <>See the place<br/><em>for yourself.</em></> : <>A closer look<br/><em>is coming.</em></>}</h2></div>{photos.length === 0 && <p>Apartment photos are being compiled. For current room details, send us a message and we’ll help you learn more.</p>}</div>{photos.length > 0 ? <div className="gallery-grid">{photos.map(photo => <figure key={photo.url}><img src={photo.url} alt={`Approved apartment photo of ${photo.building}, room ${photo.room}`} loading="lazy"/><figcaption>{photo.building} · Room {photo.room}</figcaption></figure>)}</div> : <a className="text-link" href={messenger} target="_blank" rel="noopener noreferrer">Ask for current details <span aria-hidden="true">↗</span></a>}</section>

        <section className="location-section" id="location" aria-labelledby="location-heading"><div><span className="section-number">05 / FIND US</span><h2 id="location-heading">Right here in<br/><em>Valenzuela City.</em></h2></div><div className="location-detail"><p className="location-label">Guillermo Apartment</p><p>Brgy. Lingunan<br/>Valenzuela City, Philippines</p><span>Contact us for directions and a visit.</span><a href={messenger} target="_blank" rel="noopener noreferrer" className="location-button">Message us on Messenger <span aria-hidden="true">↗</span></a></div></section>
      </main>

      <footer className="public-footer"><a className="footer-brand" href="#top"><img src="/brand-mark.svg" alt=""/> Guillermo Apartment</a><span>Brgy. Lingunan, Valenzuela City</span><a href="/staff">Staff sign in</a></footer>
    </div>
  </div>
}

export default PublicApp
