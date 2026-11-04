export type CuratedPhoto = { id: string; title: string; alt: string }

export const curatedPhotos: CuratedPhoto[] = [
  { id: '01-exterior', title: 'The exterior', alt: 'Two-storey Guillermo Apartment exterior with a balcony and motorcycle parking' },
  { id: '02-finished-studio', title: 'Finished studio', alt: 'Finished studio interior with a tiled floor, window, and kitchenette' },
  { id: '03-kitchenette-detail', title: 'Kitchenette detail', alt: 'Kitchenette counter and sink beside a frosted door' },
  { id: '04-balcony-walkway', title: 'Balcony walkway', alt: 'Outdoor balcony walkway with windows and a railing' },
  { id: '05-second-floor-corridor', title: 'Second floor corridor', alt: 'Second floor corridor lined with doors and windows' },
]

export const photoSource = (id: string, width: 480 | 800 | 1080) => `/property/${id}-${width}.jpg`
export const photoSourceSet = (id: string) => [480, 800, 1080].map(width => `${photoSource(id, width as 480 | 800 | 1080)} ${width}w`).join(', ')
