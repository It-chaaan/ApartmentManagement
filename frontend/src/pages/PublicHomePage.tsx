import { useState } from 'react'
import { RoomCard } from '../components/public/RoomCard'
import { CuratedGallery } from '../components/public/CuratedGallery'
import { curatedPhotos, photoSource, photoSourceSet } from '../data/curatedPhotos'
import { usePublicSite } from '../hooks/usePublicSite'
import { buildingRent, buildingSize } from '../utils/property'
import '../styles/public.css'

const messenger = 'https://www.facebook.com/christian.guillermo.146'
const address = '667 T. Santiago, Lingunan, Valenzuela, Metro Manila'
const mapQuery = encodeURIComponent(address)
const mapUrl = `https://www.google.com/maps?q=${mapQuery}&output=embed`
const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
function PublicHomePage() {
  const { site, error } = usePublicSite()
  const [activeBuilding, setActiveBuilding] = useState('building-1')

  const buildings = site?.buildings ?? []
  const selected = buildings.find(building => building.slug === activeBuilding) ?? buildings[0]
  const approvedRoomPhotos = buildings.flatMap(building => building.rooms.flatMap(room => room.photos))
  const exterior = curatedPhotos[0]

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
          <div className="hero-topline"><span className="eyebrow"><span className="eyebrow-dot"/> Brgy. Lingunan, Valenzuela City</span><span className="hero-index">Two buildings · 18 rooms</span></div>
          <h1 id="hero-title">A place to call home <em>in Lingunan.</em></h1>
          <div className="hero-showcase">
            <div className="hero-feature has-photo"><img src={photoSource(exterior.id, 1080)} srcSet={photoSourceSet(exterior.id)} sizes="(max-width: 760px) 100vw, 50vw" width="1080" height="1440" alt={exterior.alt} fetchPriority="high" decoding="async"/></div>
            <aside className="hero-card" aria-label="Apartment overview">
              <div><span className="card-eyebrow">GUILLERMO APARTMENT</span><h2>Find your fit in Lingunan.</h2><p>{address}</p></div>
              <div className="hero-card-stats"><div><strong>2</strong><span>buildings</span></div><div><strong>18</strong><span>rooms</span></div><div><strong>₱4k</strong><span>rent from / mo.</span></div></div>
              <p className="card-description">Furnished rooms with individual water and electricity meters. Ask us about current availability.</p>
              <div className="hero-card-actions"><a href={messenger} target="_blank" rel="noopener noreferrer" className="primary-button">Ask about a room <span aria-hidden="true">↗</span></a><a href="#rooms" className="secondary-link">Browse rooms <span aria-hidden="true">→</span></a></div>
            </aside>
          </div>
          <div className="hero-search" aria-label="Explore apartment details"><a href="#location"><span>LOCATION</span><strong>Lingunan, Valenzuela</strong></a><a href="#buildings"><span>PROPERTY</span><strong>Two buildings</strong></a><a href="#rooms"><span>MONTHLY RENT</span><strong>₱4,000–₱5,000</strong></a><a href="#rooms" className="search-action">Explore rooms <span aria-hidden="true">→</span></a></div>
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

        <section className="location-section" id="location" aria-labelledby="location-heading"><div className="location-copy"><span className="section-number">05 / FIND US</span><h2 id="location-heading">Come see where<br/><em>we are.</em></h2><p className="location-label">Guillermo Apartment</p><address>{address}</address><p>Use the map for the area, and message us to arrange a visit or confirm directions.</p><a href={mapLink} target="_blank" rel="noopener noreferrer" className="location-button">Open in Google Maps <span aria-hidden="true">↗</span></a></div><div className="map-frame"><iframe title={`Map search for ${address}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /><span>Map search · {address}</span></div></section>
      </main>

      <footer className="public-footer"><a className="footer-brand" href="#top"><img src="/brand-mark.svg" alt=""/> Guillermo Apartment</a><span>{address}</span><a href="/staff">Staff sign in</a></footer>
    </div>
  </div>
}

export default PublicHomePage
