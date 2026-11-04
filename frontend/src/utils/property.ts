import type { PublicBuilding, PublicRoom } from '../types/public'
import type { Room, RoomForm } from '../types/staff'

export const formatPublicPeso = (value: string) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
}).format(Number(value))

export const formatStaffPeso = (value: string) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP',
}).format(Number(value))

export const publicRoomSize = (room: PublicRoom) => room.size_min_sqm === room.size_max_sqm
  ? `${Number(room.size_min_sqm)} sqm`
  : `Approx. ${Number(room.size_min_sqm)}–${Number(room.size_max_sqm)} sqm`

export const staffRoomSize = (room: Room) => room.size_min_sqm === room.size_max_sqm
  ? `${Number(room.size_min_sqm)} sqm`
  : `Approx. ${Number(room.size_min_sqm)}–${Number(room.size_max_sqm)} sqm`

export const floorName = (floor: number) => floor === 1 ? 'First floor' : 'Second floor'
export const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1)

export const buildingSize = (building: PublicBuilding) => {
  if (!building.rooms.length) return '—'
  const min = Math.min(...building.rooms.map(room => Number(room.size_min_sqm)))
  const max = Math.max(...building.rooms.map(room => Number(room.size_max_sqm)))
  return min === max ? `${min} sqm` : `Approx. ${min}–${max} sqm`
}

export const buildingRent = (building: PublicBuilding) => {
  if (!building.rooms.length) return '—'
  const rents = building.rooms.map(room => Number(room.monthly_rent))
  const min = Math.min(...rents)
  const max = Math.max(...rents)
  return min === max ? formatPublicPeso(String(min)) : `${formatPublicPeso(String(min))}–${formatPublicPeso(String(max))}`
}

export const roomToForm = (room: Room): RoomForm => ({
  floor: String(room.floor),
  side: room.side ?? '',
  size_min_sqm: room.size_min_sqm,
  size_max_sqm: room.size_max_sqm,
  monthly_rent: room.monthly_rent,
  amenities: room.amenities.join(', '),
  description: room.description ?? '',
  status: room.status,
})
