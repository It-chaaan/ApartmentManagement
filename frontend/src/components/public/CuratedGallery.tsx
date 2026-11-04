import { useEffect, useRef, useState } from 'react'
import { curatedPhotos, photoSource, photoSourceSet } from '../../data/curatedPhotos'

export function CuratedGallery() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (activeIndex === null) {
      if (element.open) element.close()
      return
    }
    if (!element.open) element.showModal()
  }, [activeIndex])

  const close = () => { setActiveIndex(null); opener.current?.focus() }
  const move = (step: number) => setActiveIndex(index => index === null ? null : (index + step + curatedPhotos.length) % curatedPhotos.length)
  const active = activeIndex === null ? null : curatedPhotos[activeIndex]

  return <>
    <div className="gallery-grid">{curatedPhotos.slice(1).map((photo, index) => <figure key={photo.id}>
      <button type="button" className="gallery-open" aria-label={`View photo ${index + 2} of ${curatedPhotos.length}: ${photo.alt}`} onClick={event => { opener.current = event.currentTarget; setActiveIndex(index + 1) }}>
        <img src={photoSource(photo.id, 800)} srcSet={photoSourceSet(photo.id)} sizes="(max-width: 700px) calc(50vw - 36px), (max-width: 1050px) calc(50vw - 70px), 25vw" width="1080" height="1440" alt={photo.alt} loading="lazy" decoding="async" />
      </button><figcaption><span className="gallery-number">0{index + 2}</span>{photo.title}</figcaption>
    </figure>)}</div>
    <dialog ref={dialog} className="gallery-dialog" aria-label="Property photo viewer" onClose={close} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) } else if (event.key === 'ArrowRight') { event.preventDefault(); move(1) } }} onClick={event => { if (event.target === dialog.current) close() }}>
      {active && <div className="gallery-dialog-content"><div className="gallery-dialog-top"><span>{String(activeIndex! + 1).padStart(2, '0')} / {String(curatedPhotos.length).padStart(2, '0')}</span><button type="button" onClick={close} aria-label="Close photo viewer">Close ×</button></div><img src={photoSource(active.id, 1080)} srcSet={photoSourceSet(active.id)} sizes="min(90vw, 800px)" width="1080" height="1440" alt={active.alt}/><div className="gallery-dialog-bottom"><button type="button" onClick={() => move(-1)} aria-label="Previous photo">← Previous</button><strong>{active.title}</strong><button type="button" onClick={() => move(1)} aria-label="Next photo">Next →</button></div></div>}
    </dialog>
  </>
}
