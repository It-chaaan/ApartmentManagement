import type { PublicRoom } from '../../types/public'
import { floorName, formatPublicPeso, publicRoomSize } from '../../utils/property'

export function RoomCard({ room }: { room: PublicRoom }) {
  return <article className="room-card">
    <div className="room-card-top"><span>{floorName(room.floor)}{room.side ? ` · ${room.side} side` : ''}</span><span className={room.availability === 'available' ? 'room-available' : 'room-ask'}>{room.availability === 'available' ? 'Available' : 'Ask for availability'}</span></div>
    <h3>Room {room.code}</h3>
    <div className="room-card-bottom"><span>{publicRoomSize(room)}</span><strong>{formatPublicPeso(room.monthly_rent)}<small> / month</small></strong></div>
  </article>
}
