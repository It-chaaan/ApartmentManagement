import type { PublicBuilding, PublicRoom, PublicSite } from '../types/public'

const amenities = ['Furnished rooms', 'Motorcycle parking', 'Individual water meter', 'Individual electricity meter']
const address = 'Brgy. Lingunan, Valenzuela City'

function room(code: string, floor: number, side: string | null, size: string, maxSize: string, rent: string): PublicRoom {
  return { code, floor, side, size_min_sqm: size, size_max_sqm: maxSize, monthly_rent: rent, availability: 'ask', photos: [] }
}

const buildingOneRooms = [1, 2].flatMap(floor => ['A', 'B', 'C', 'D', 'E', 'F'].map(letter =>
  room(`${floor}-${letter}`, floor, null, '24.00', '25.00', '5000.00')))
const buildingTwoRooms = [1, 2, 3, 4, 5, 6].map(code => room(String(code), code <= 2 ? 1 : 2, null, '18.00', '18.00', '4000.00'))

function building(slug: string, name: string, lotArea: string, rooms: PublicRoom[]): PublicBuilding {
  return { slug, name, address, lot_area_sqm: lotArea, room_count: rooms.length, amenities, rooms }
}

// Public-only deployment: the confirmed layout is shown without live availability or staff uploads.
export const staticPublicSite: PublicSite = {
  buildings: [building('building-1', 'Building 1', '200.00', buildingOneRooms), building('building-2', 'Building 2', '100.00', buildingTwoRooms)],
}
