export type Status = 'unverified' | 'available' | 'reserved' | 'occupied' | 'maintenance'

export type Building = {
  id: number
  name: string
  address: string
  lot_area_sqm: string
  description: string
  amenities: string[]
  rooms_count: number
}

export type Photo = { id: number; url: string; original_name: string; is_public: boolean }

export type Room = {
  id: number
  building_id: number
  building: { name: string }
  code: string
  floor: number
  side: string | null
  size_min_sqm: string
  size_max_sqm: string
  monthly_rent: string
  amenities: string[]
  description: string | null
  status: Status
  photos: Photo[]
}

export type StaffUser = { name: string; email: string; role: string }

export type RoomForm = {
  floor: string
  side: string
  size_min_sqm: string
  size_max_sqm: string
  monthly_rent: string
  amenities: string
  description: string
  status: Status
}
