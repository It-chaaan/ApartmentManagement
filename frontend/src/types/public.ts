export type PublicPhoto = { url: string; building: string; room: string }

export type PublicRoom = {
  code: string
  floor: number
  side: string | null
  size_min_sqm: string
  size_max_sqm: string
  monthly_rent: string
  availability: 'available' | 'ask'
  photos: PublicPhoto[]
}

export type PublicBuilding = {
  slug: string
  name: string
  address: string
  lot_area_sqm: string
  room_count: number
  amenities: string[]
  rooms: PublicRoom[]
}

export type PublicSite = { buildings: PublicBuilding[] }
