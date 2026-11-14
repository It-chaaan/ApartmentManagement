import { useState } from 'react'
import type { MouseEvent } from 'react'
import { RoomCard } from '../components/public/RoomCard'
import { CuratedGallery } from '../components/public/CuratedGallery'
import { curatedPhotos, photoSource, photoSourceSet } from '../data/curatedPhotos'
import { usePublicSite } from '../hooks/usePublicSite'
import { buildingRent, buildingSize } from '../utils/property'
import '../styles/public.css'

const messenger = 'https://www.facebook.com/christian.guillermo.146'
const address = 'T. Santiago, Brgy. Lingunan, Valenzuela City'
const mapQuery = encodeURIComponent('Brgy. Lingunan, Valenzuela City')
const mapUrl = `https://www.google.com/maps?q=${mapQuery}&output=embed`
const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
const publicOnly = import.meta.env.MODE === 'public'
function PublicHomePage() {
  const { site, error } = usePublicSite()
  const [activeBuilding, setActiveBuilding] = useState('building-1')
  const [openingStaff, setOpeningStaff] = useState(false)
  const goToStaff = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    event.preventDefault()
    if (openingStaff) return
    setOpeningStaff(true)
    window.setTimeout(() => { window.location.assign('/staff') }, 520)
  }

  const buildings = site?.buildings ?? []
  const selected = buildings.find(building => building.slug === activeBuilding) ?? buildings[0]
  const approvedRoomPhotos = buildings.flatMap(building => building.rooms.flatMap(room => room.photos))
  const exterior = curatedPhotos[0]
  const studio = curatedPhotos[1]

  return <div className="public-shell" id="top">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="public-canvas">
      <header className="public-header">
        <a className="public-brand" href="#top" aria-label="Guillermo Apartment, back to top"><img src="/brand-mark.svg" alt=""/><span>Guillermo<br/>Apartment</span></a>
        <nav className="public-nav" aria-label="Main navigation"><a href="#buildings">Buildings</a><a href="#rooms">Rooms</a><a href="#location">Location</a><a className="public-nav-contact" href="#contact">Contact</a></nav>
        <div className="public-header-actions"><a className="header-contact" href="#contact">Contact</a>{!publicOnly && <a className="nav-action" href="/staff" onClick={goToStaff}>Apartment management <span aria-hidden="true">↗</span></a>}</div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-showcase">
            <div className="hero-content"><span className="hero-kicker">GUILLERMO APARTMENT / VALENZUELA CITY</span><h1 id="hero-title">A PLACE<br/>TO CALL<br/><em>HOME.</em></h1><p>Furnished rooms, individual utility meters, and space for your motorcycle. See the rooms, then ask us about a visit.</p><div className="hero-actions"><a href="#rooms" className="hero-primary">Explore rooms <span aria-hidden="true">→</span></a></div></div>
            <div className="hero-feature has-photo"><img src={photoSource(exterior.id, 1080)} srcSet={photoSourceSet(exterior.id)} sizes="(max-width: 900px) 100vw, 50vw" width="1080" height="1440" alt={exterior.alt} fetchPriority="high" decoding="async"/></div>
            <aside className="hero-location" aria-label="Apartment location"><span className="hero-rail-label">FIND US</span><div className="hero-location-copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><address>{address}</address></div><a href="#location">View location <span aria-hidden="true">↗</span></a></aside>
            <figure className="hero-inset"><img src={photoSource(studio.id, 800)} srcSet={photoSourceSet(studio.id)} sizes="(max-width: 600px) 42vw, 22vw" width="800" height="1067" alt={studio.alt} decoding="async"/><figcaption>INSIDE THE APARTMENT <span aria-hidden="true">↗</span></figcaption></figure>
          </div>
          <div className="hero-summary" aria-label="Building summary"><div className="hero-summary-intro"><span>THE PROPERTY</span><strong>Two buildings. <br/>One place to settle.</strong></div><a href="#rooms" onClick={() => setActiveBuilding('building-1')}><span>01 / BUILDING 1</span><strong>12 rooms</strong><small>From ₱5,000 / month</small></a><a href="#rooms" onClick={() => setActiveBuilding('building-2')}><span>02 / BUILDING 2</span><strong>6 rooms</strong><small>From ₱4,000 / month</small></a><a href="#buildings" className="hero-summary-link">Compare buildings <span aria-hidden="true">↗</span></a></div>
        </section>

        <section className="public-section building-section" id="buildings" aria-labelledby="building-heading">
          <div className="section-intro"><span className="section-number">01 / THE BUILDINGS</span><h2 id="building-heading">Explore our buildings.</h2><p>Two choices in one neighborhood. Compare the room sizes, rent, and layout before you inquire.</p></div>
          <div className="building-list">{buildings.map((building, index) => <article className="building-row" key={building.slug}>
            <div className="building-ident"><span className="building-num">0{index + 1} / GUILLERMO APARTMENT</span><h3>{building.name}</h3><p>{address}</p></div>
            <div className="building-specs"><div><strong>{building.room_count}</strong><span>rooms</span></div><div><strong>{buildingSize(building)}</strong><span>room size</span></div><div><strong>{buildingRent(building)}</strong><span>monthly rent per room</span></div><div><strong>{Number(building.lot_area_sqm)} sqm</strong><span>lot area</span></div></div>
            <div className="building-footer"><p>{building.slug === 'building-2' ? 'About half of the first floor is motorcycle parking. Rooms 1–2 are on the first floor; rooms 3–6 are above.' : 'Six rooms on each floor, with right and left side layouts.'}</p><a href="#rooms" onClick={() => setActiveBuilding(building.slug)} className="round-link" aria-label={`See ${building.name} rooms`}>View rooms <span aria-hidden="true">↗</span></a></div>
          </article>)}</div>
          {error && <p className="public-error" role="alert">{error}</p>}
          {!site && !error && <p className="public-loading" role="status">Loading building details…</p>}
        </section>

        <section className="amenities-band" aria-labelledby="amenities-heading"><div><span className="section-number">02 / EVERYDAY ESSENTIALS</span><h2 id="amenities-heading">Details that<br/><em>make a difference.</em></h2></div><ul><li><span>01</span> Furnished rooms</li><li><span>02</span> Motorcycle parking</li><li><span>03</span> Individual water meters</li><li><span>04</span> Individual electricity meters</li></ul></section>

        <section className="public-section rooms-section" id="rooms" aria-labelledby="rooms-heading"><div className="rooms-head"><div><span className="section-number">03 / THE ROOMS</span><h2 id="rooms-heading">Find a room<br/><em>that fits.</em></h2></div><p>Browse the room layout and ask us directly about current availability. Only rooms confirmed as available are labeled available here.</p></div>
          {buildings.length > 0 && <><div className="room-tabs" role="group" aria-label="Choose a building">{buildings.map(building => <button key={building.slug} type="button" className={selected?.slug === building.slug ? 'active' : ''} onClick={() => setActiveBuilding(building.slug)} aria-pressed={selected?.slug === building.slug}>{building.name} <span>{building.room_count} rooms</span></button>)}</div><div className="room-grid">{selected?.rooms.map(room => <RoomCard key={room.code} room={room} />)}</div></>}
          <a className="inline-inquiry" href={messenger} target="_blank" rel="noopener noreferrer">Ask about a room on Messenger <span aria-hidden="true">↗</span></a>
        </section>

        <section className="public-section gallery-section" id="gallery" aria-labelledby="gallery-heading"><div className="gallery-intro"><div><span className="section-number">04 / THE SPACE</span><h2 id="gallery-heading">See the place<br/><em>for yourself.</em></h2></div><p>A look at the property and its spaces. These photos do not indicate which rooms are currently available.</p></div><CuratedGallery/>{approvedRoomPhotos.length > 0 && <div className="approved-room-gallery"><h3>More room photos</h3><p>Published by staff with room attribution.</p><div className="gallery-grid">{approvedRoomPhotos.map(photo => <figure key={photo.url}><img src={photo.url} alt={`Approved photo of ${photo.building}, room ${photo.room}`} loading="lazy" decoding="async"/><figcaption>{photo.building} · Room {photo.room}</figcaption></figure>)}</div></div>}</section>

        <section className="location-section" id="location" aria-labelledby="location-heading"><div className="location-copy"><span className="section-number">05 / FIND US</span><h2 id="location-heading">Come see where<br/><em>we are.</em></h2><p className="location-label">Guillermo Apartment</p><address>{address}</address><p>The map shows the neighborhood. Message us for the exact location and to arrange a visit.</p><a href={mapLink} target="_blank" rel="noopener noreferrer" className="location-button">View neighborhood map <span aria-hidden="true">↗</span></a></div><div className="map-frame"><iframe title="Map of Brgy. Lingunan, Valenzuela City neighborhood" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /><span>Neighborhood map · exact pin available on request</span></div></section>
        <section className="contact-section" id="contact" aria-labelledby="contact-heading"><div><span className="section-number">06 / GET IN TOUCH</span><h2 id="contact-heading">Have a room in mind?</h2><p>Ask about current availability or arrange a visit. We’ll help you find the right building and room.</p></div><a href={messenger} target="_blank" rel="noopener noreferrer" className="contact-button">Message us on Messenger <span aria-hidden="true">↗</span></a></section>
      </main>

      <footer className="public-footer"><a className="footer-brand" href="#top"><img src="/brand-mark.svg" alt=""/> Guillermo Apartment</a><span>{address}</span>{!publicOnly && <a href="/staff" onClick={goToStaff}>Staff sign in</a>}</footer>
    </div>
    {openingStaff && <div className="staff-route-transition" role="status" aria-live="polite"><div className="staff-route-transition-inner"><img src="/brand-mark.svg" alt="" width="50" height="50"/><span>Opening staff sign in</span><span className="staff-route-progress" aria-hidden="true"/></div></div>}
  </div>
}

export default PublicHomePage
