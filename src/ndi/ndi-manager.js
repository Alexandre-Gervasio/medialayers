// ============================================================
// src/ndi/ndi-manager.js
// Gerencia o processo ndi_bridge e repassa dados para o Electron
// ============================================================

const { spawn } = require('child_process')
const path      = require('path')
const fs        = require('fs')
const readline  = require('readline')

const BRIDGE_PATH = path.join(__dirname, 'ndi_bridge')
const activeReceivers = {}

function isAvailable() {
  const exists = fs.existsSync(BRIDGE_PATH)
  if (!exists) console.warn('[NDI] Bridge não encontrado em:', BRIDGE_PATH)
  return exists
}

function findSources(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!isAvailable()) { resolve([]); return }
    const proc = spawn(BRIDGE_PATH)
    const rl   = readline.createInterface({ input: proc.stdout })
    let resolved = false
    const done = (sources) => {
      if (resolved) return
      resolved = true
      try { proc.kill() } catch {}
      resolve(sources)
    }
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line)
        if (msg.type === 'sources') done(msg.list || [])
        if (msg.type === 'error')   done([])
      } catch {}
    })
    proc.on('close', () => done([]))
    proc.stderr.on('data', (d) => console.error('[NDI find stderr]', d.toString()))
    setTimeout(() => done([]), timeoutMs)
  })
}

async function startReceiver(layerId, sourceIndex, onFrame) {
  if (!isAvailable()) throw new Error('ndi_bridge não encontrado. Compile primeiro.')
  await stopReceiver(layerId)
  const proc = spawn(BRIDGE_PATH)
  activeReceivers[layerId] = { proc }
  const rl = readline.createInterface({ input: proc.stdout })
  let waitingForFrame = null
  let binaryBuffer    = Buffer.alloc(0)
  let inBinaryMode    = false
  let rlClosed        = false

  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line)
      if (msg.type === 'sources') proc.stdin.write(String(sourceIndex) + '\n')
      if (msg.type === 'status')  console.log(`[NDI] layerId=${layerId}:`, msg.msg)
      if (msg.type === 'frame') {
        waitingForFrame = { w: msg.w, h: msg.h, bytes: msg.bytes }
        inBinaryMode    = true
        if (!rlClosed) { rlClosed = true; rl.close() }
      }
      if (msg.type === 'error') console.error('[NDI] Bridge error:', msg.msg)
    } catch {}
  })

  proc.stdout.on('data', (chunk) => {
    if (!inBinaryMode || !waitingForFrame) return
    binaryBuffer = Buffer.concat([binaryBuffer, chunk])
    while (waitingForFrame && binaryBuffer.length >= waitingForFrame.bytes) {
      const frameData = binaryBuffer.slice(0, waitingForFrame.bytes)
      binaryBuffer    = binaryBuffer.slice(waitingForFrame.bytes)
      if (onFrame && activeReceivers[layerId]) {
        onFrame(layerId, { xres: waitingForFrame.w, yres: waitingForFrame.h, data: frameData })
      }
      waitingForFrame = null
      inBinaryMode    = false
      const nextNewline = binaryBuffer.indexOf('\n')
      if (nextNewline !== -1) {
        const jsonLine = binaryBuffer.slice(0, nextNewline).toString()
        binaryBuffer   = binaryBuffer.slice(nextNewline + 1)
        try {
          const msg = JSON.parse(jsonLine)
          if (msg.type === 'frame') {
            waitingForFrame = { w: msg.w, h: msg.h, bytes: msg.bytes }
            inBinaryMode    = true
          }
        } catch {}
      }
    }
  })

  proc.stderr.on('data', (d) => console.error('[NDI bridge stderr]', d.toString()))
  proc.on('close', (code) => {
    console.log(`[NDI] Bridge fechado (layerId=${layerId}, code=${code})`)
    delete activeReceivers[layerId]
  })
  return proc
}

async function stopReceiver(layerId) {
  const r = activeReceivers[layerId]
  if (r) { try { r.proc.kill() } catch {} ; delete activeReceivers[layerId] }
}

async function stopAllReceivers() {
  for (const id of Object.keys(activeReceivers)) await stopReceiver(id)
}

let ndiSenderActive = false

async function startSender(sourceName = 'MediaLayers') {
  if (!isAvailable()) {
    throw new Error('Indice NDI não disponível para sender')
  }

  ndiSenderActive = true
  console.log('[NDI] Sender iniciado (simulação):', sourceName)
  return { started: true, sourceName }
}

async function stopSender() {
  ndiSenderActive = false
  console.log('[NDI] Sender parado (simulação).')
}

async function sendFrame(width, height, data) {
  if (!ndiSenderActive) {
    console.warn('[NDI] Nenhum sender ativo. Ignorando sendFrame.')
    return
  }

  // NDI real aqui: converter para frame e enviar pela API NDI
  // Implementar de fato com Processing.NDI.Lib ao publicar o quadro.
  console.log(`[NDI] sendFrame ${width}x${height} - ${data ? data.length : 0} bytes`) 
}

module.exports = {
  isAvailable,
  findSources,
  startReceiver,
  stopReceiver,
  stopAllReceivers,
  startSender,
  stopSender,
  sendFrame
}
