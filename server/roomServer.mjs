/**
 * Minimal room server: numeric room ids, matchmaking queue, JSON relay.
 * Run: `npm run server` (default ws://0.0.0.0:8787).
 */
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST ?? '0.0.0.0'

/** @type {Map<string, { clients: Map<string, import('ws').WebSocket>, hostId: string }>} */
const rooms = new Map()
/** @type {Map<string, string>} */
const clientToRoom = new Map()

/** @type {import('ws').WebSocket | null} */
let waitingClient = null
let nextRoomId = 1000
let nextClientId = 0

function makeRoomCode() {
  nextRoomId += 1
  return String(nextRoomId)
}

function nextClientKey() {
  nextClientId += 1
  return `c${nextClientId}`
}

/** @param {import('ws').WebSocket | null | undefined} ws */
function safeSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return
  ws.send(JSON.stringify(payload))
}

/**
 * @param {import('ws').WebSocket} ws
 */
function dequeueIfQueued(ws) {
  if (!ws.isSearching) return
  ws.isSearching = false
  if (waitingClient === ws) waitingClient = null
}

/**
 * @param {import('ws').WebSocket} ws
 */
function handleQueueJoin(ws) {
  if (ws.roomCode) return
  if (ws.isSearching) return

  if (!waitingClient || waitingClient === ws || waitingClient.readyState !== 1) {
    waitingClient = ws
    ws.isSearching = true
    safeSend(ws, {
      type: 'queue_status',
      status: 'waiting',
    })
    return
  }

  const other = waitingClient
  waitingClient = null

  const roomCode = makeRoomCode()

  rooms.set(roomCode, {
    hostId: other.clientId,
    clients: new Map([
      [other.clientId, other],
      [ws.clientId, ws],
    ]),
  })

  other.roomCode = roomCode
  ws.roomCode = roomCode
  other.isSearching = false
  ws.isSearching = false
  other.role = 'host'
  ws.role = 'guest'

  clientToRoom.set(other.clientId, roomCode)
  clientToRoom.set(ws.clientId, roomCode)

  safeSend(other, {
    type: 'match_found',
    roomCode,
    role: 'host',
    peerId: ws.clientId,
  })

  safeSend(ws, {
    type: 'match_found',
    roomCode,
    role: 'guest',
    peerId: other.clientId,
  })
}

/**
 * @param {import('ws').WebSocket} ws
 */
function handleQueueLeave(ws) {
  if (waitingClient === ws) {
    waitingClient = null
  }
  ws.isSearching = false
  safeSend(ws, {
    type: 'queue_status',
    status: 'idle',
  })
}

/**
 * @param {import('ws').WebSocket} ws
 */
function handleDisconnect(ws) {
  if (waitingClient === ws) {
    waitingClient = null
  }

  const roomCode = ws.roomCode
  if (!roomCode) return

  const room = rooms.get(roomCode)
  if (!room) {
    clientToRoom.delete(ws.clientId)
    return
  }

  const remaining = [...room.clients.values()].filter(
    (c) => c !== ws && c.readyState === 1,
  )

  for (const client of remaining) {
    client.roomCode = null
    safeSend(client, {
      type: 'peer_left',
    })
  }

  for (const id of room.clients.keys()) {
    clientToRoom.delete(id)
  }

  rooms.delete(roomCode)
}

const server = new WebSocketServer({ host: HOST, port: PORT })

server.on('connection', (ws) => {
  const clientId = nextClientKey()
  ws.clientId = clientId
  ws.roomCode = null
  ws.role = null
  ws.isSearching = false

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (!msg || typeof msg.type !== 'string') return

    if (msg.type === 'queue_join') {
      handleQueueJoin(ws)
      return
    }

    if (msg.type === 'queue_leave') {
      handleQueueLeave(ws)
      return
    }

    if (msg.type === 'create_room') {
      dequeueIfQueued(ws)
      const code = makeRoomCode()
      rooms.set(code, {
        hostId: clientId,
        clients: new Map([[clientId, ws]]),
      })
      clientToRoom.set(clientId, code)
      ws.roomCode = code
      ws.role = 'host'
      safeSend(ws, { type: 'created', room: code, role: 'host' })
      return
    }

    if (msg.type === 'join_room') {
      dequeueIfQueued(ws)
      const code = String(msg.roomCode ?? '').replace(/\D/g, '')
      if (!code || code.length > 12) {
        safeSend(ws, { type: 'error', code: 'ROOM_FORMAT' })
        return
      }
      const r = rooms.get(code)
      if (!r) {
        safeSend(ws, { type: 'error', code: 'ROOM_NOT_FOUND' })
        return
      }
      if (r.clients.size >= 2) {
        safeSend(ws, { type: 'error', code: 'ROOM_FULL' })
        return
      }
      r.clients.set(clientId, ws)
      clientToRoom.set(clientId, code)
      ws.roomCode = code
      ws.role = 'guest'
      const hostWs = r.clients.get(r.hostId)
      safeSend(ws, { type: 'joined', room: code, role: 'guest' })
      if (hostWs) safeSend(hostWs, { type: 'peer_joined' })
      safeSend(ws, { type: 'peer_joined' })
      return
    }

    const relayTypes = new Set([
      'inp',
      'ping',
      'match_sync',
      'rematch_request',
      'rematch_accept',
      'rematch_decline',
      'fighter_selected',
      'player_ready',
      'match_start',
    ])
    if (msg.type === 'player_ready') {
      const cid = msg.charId ?? msg.characterId
      if (cid == null || cid === '') {
        console.warn('[ROOM_SERVER] player_ready rejected missing charId', {
          senderId: clientId,
          roomCode: ws.roomCode,
          role: ws.role,
        })
      }
      if (!ws.roomCode || !ws.role) {
        console.warn('[ROOM_SERVER] player_ready DROPPED (client not in room yet)', {
          senderId: clientId,
          roomCode: ws.roomCode,
          role: ws.role,
          charId: cid,
        })
      }
    }
    if (!ws.roomCode || !ws.role || !relayTypes.has(msg.type)) return
    const r = rooms.get(ws.roomCode)
    if (!r) return
    for (const [id, peer] of r.clients) {
      if (id !== clientId) {
        if (msg.type === 'player_ready' || msg.type === 'match_start' || msg.type === 'match_sync') {
          console.info('[ROOM_RELAY]', {
            type: msg.type,
            roomCode: ws.roomCode,
            senderId: clientId,
            recipientId: id,
            payloadCharId: msg.type === 'player_ready' ? msg.charId : undefined,
            payload: msg,
          })
        }
        safeSend(peer, msg)
        return
      }
    }
  })

  ws.on('close', () => {
    if (ws.isSearching) {
      ws.isSearching = false
    }
    handleDisconnect(ws)
  })
})

console.info(`[Toybox Brawlers:rooms] ws://localhost:${PORT} (listening on ${HOST}:${PORT})`)
