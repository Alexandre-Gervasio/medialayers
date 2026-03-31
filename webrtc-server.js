// ════════════════════════════════════════════════════════════════
// webrtc-server.js
// MediaLayers Fase 7 - WebRTC Signaling Server
// ════════════════════════════════════════════════════════════════

const { createServer } = require('http')
const { Server } = require('socket.io')
const express = require('express')

// Verifica se express está instalado, se não, usa http puro
let expressApp = null
try {
  expressApp = express()
} catch (e) {
  console.log('Express não encontrado, usando HTTP puro')
}

const app = expressApp || createServer()
const server = expressApp ? createServer(expressApp) : app
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Estado das conexões WebRTC
const rooms = new Map() // roomId -> { offer, answer, candidates: [] }

// ─────────────────────────────────────────────────
// SOCKET.IO HANDLING
// ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id)

  // Entrar em uma sala
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    console.log(`Cliente ${socket.id} entrou na sala ${roomId}`)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { offer: null, answer: null, candidates: [] })
    }

    // Notificar outros na sala
    socket.to(roomId).emit('user-joined', socket.id)
  })

  // WebRTC Signaling
  socket.on('webrtc-offer', (data) => {
    const { roomId, offer } = data
    console.log(`Offer recebida na sala ${roomId}`)

    const room = rooms.get(roomId)
    if (room) {
      room.offer = offer
      socket.to(roomId).emit('webrtc-offer', offer)
    }
  })

  socket.on('webrtc-answer', (data) => {
    const { roomId, answer } = data
    console.log(`Answer recebida na sala ${roomId}`)

    const room = rooms.get(roomId)
    if (room) {
      room.answer = answer
      socket.to(roomId).emit('webrtc-answer', answer)
    }
  })

  socket.on('webrtc-candidate', (data) => {
    const { roomId, candidate } = data
    console.log(`ICE candidate na sala ${roomId}`)

    socket.to(roomId).emit('webrtc-candidate', candidate)
  })

  // Ping/Pong para status
  socket.on('ping', () => {
    socket.emit('pong')
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
  })
})

// ─────────────────────────────────────────────────
// HTTP ENDPOINTS
// ─────────────────────────────────────────────────
if (expressApp) {
  expressApp.use(express.json())

  // Status do servidor
  expressApp.get('/status', (req, res) => {
    res.json({
      status: 'running',
      port: PORT,
      rooms: Array.from(rooms.keys()),
      connections: io.sockets.sockets.size
    })
  })

  // Iniciar servidor (já está rodando)
  expressApp.post('/start', (req, res) => {
    res.json({ status: 'already_running', port: PORT })
  })

  // Parar servidor
  expressApp.post('/stop', (req, res) => {
    res.json({ status: 'stopping' })
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  })
}

// ─────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────
const PORT = process.env.WEBRTC_PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 WebRTC Signaling Server rodando na porta ${PORT}`)
  console.log(`📡 Endpoint: ws://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Encerrando servidor WebRTC...')
  server.close(() => {
    process.exit(0)
  })
})

module.exports = { server, io }