/**
 * Canonical WebSocket envelope types (room server ↔ browser client).
 */
export type ClientToServer =
  | { type: 'queue_join' }
  | { type: 'queue_leave' }
  | { type: 'create_room' }
  | { type: 'join_room'; roomCode: string }
  | { type: 'match_sync'; payload: unknown }

export type ClientGameplayMessage =
  | { type: 'fighter_selected'; charId: string }
  /** Confirms fighter for the round — includes `charId` (lock + ready in one step). */
  | { type: 'player_ready'; charId: string }
  | { type: 'match_start'; hostCharId: string; guestCharId: string }
  | { type: 'inp'; f: number; h: string[]; p: string[]; r: string[] }
  | { type: 'ping' }
  /** Post-match: return to fighter select (rematch flow); peer mirrors navigation. */
  | { type: 'rematch_request' }
  /** Rematch character select: player accepts same matchup. */
  | { type: 'rematch_accept' }
  /** Rematch character select: player declines — peer shows failure and exits. */
  | { type: 'rematch_decline' }

export type ClientWireMessage = ClientToServer | ClientGameplayMessage

export type ServerToClient =
  | { type: 'queue_status'; status: 'waiting' | 'idle' }
  | { type: 'match_found'; roomCode: string; role: 'host' | 'guest'; peerId: string }
  | { type: 'peer_left' }
  | { type: 'match_sync'; payload: unknown }

export type ServerLobbyMessage =
  | { type: 'created'; room: string; role: 'host' | 'guest' }
  | { type: 'joined'; room: string; role: 'host' | 'guest' }
  | { type: 'peer_joined' }
  | { type: 'error'; code: string }

export type ServerGameplayRx =
  | { type: 'fighter_selected'; charId: string }
  | { type: 'player_ready'; charId: string }
  | { type: 'match_start'; hostCharId: string; guestCharId: string }
  | { type: 'inp'; f: number; h: string[]; p: string[]; r: string[] }
  | { type: 'ping' }
  | { type: 'rematch_request' }
  | { type: 'rematch_accept' }
  | { type: 'rematch_decline' }

export type ServerWireMessage = ServerToClient | ServerLobbyMessage | ServerGameplayRx
