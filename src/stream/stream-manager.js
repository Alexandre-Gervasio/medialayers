// ============================================================
// src/stream/stream-manager.js
// Parte 7: Gerencia stream RTMP e gravação com FFmpeg
// Chamado pelo main.js via IPC
// ============================================================

const { spawn }  = require('child_process')
const path       = require('path')
const fs         = require('fs')
const { app }    = require('electron')

// ── Estado interno ────────────────────────────────────────
let ffmpegStream   = null   // processo FFmpeg de stream
let ffmpegRecord   = null   // processo FFmpeg de gravação
let streamActive   = false
let recordActive   = false

// ── Caminho padrão para gravações ────────────────────────
function getRecordingsDir() {
  const dir = path.join(app.getPath('videos'), 'MediaLayers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Localiza o executável do FFmpeg ──────────────────────
// Tenta: variável de ambiente > PATH > pasta resources
function findFFmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH
  }
  // Tenta pelo PATH
  const candidates = process.platform === 'win32'
    ? ['ffmpeg.exe']
    : ['ffmpeg']

  for (const name of candidates) {
    try {
      const { execSync } = require('child_process')
      execSync(`${name} -version`, { stdio: 'ignore' })
      return name  // encontrado no PATH
    } catch {}
  }

  // Tenta pasta resources (para distribuição empacotada)
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'resources')
  const bundled = path.join(resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (fs.existsSync(bundled)) return bundled

  return null
}

// ─────────────────────────────────────────────
// INICIAR STREAM RTMP
// Recebe frames RGBA da janela de saída e envia via RTMP
// ─────────────────────────────────────────────
function startStream({ rtmpUrl, width = 1920, height = 1080, fps = 30, bitrate = '4500k', audioBitrate = '128k' }) {
  if (streamActive) throw new Error('Stream já está ativo.')
  if (!rtmpUrl)     throw new Error('URL RTMP não informada.')

  const ffmpegPath = findFFmpeg()
  if (!ffmpegPath) throw new Error('FFmpeg não encontrado. Instale e adicione ao PATH.')

  // Entrada: pipe de frames RGBA brutos (stdin)
  const args = [
    '-y',
    // Entrada de vídeo via pipe (frames RGBA raw)
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${width}x${height}`,
    '-framerate', String(fps),
    '-i', 'pipe:0',
    // Entrada de áudio: silêncio gerado (pode ser substituído por loopback real)
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    // Codificação de vídeo
    '-vcodec', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-bufsize', '2x' + bitrate,
    '-pix_fmt', 'yuv420p',
    '-g', String(fps * 2),   // keyframe a cada 2s
    // Codificação de áudio
    '-acodec', 'aac',
    '-b:a', audioBitrate,
    '-ar', '44100',
    // Saída RTMP
    '-f', 'flv',
    rtmpUrl
  ]

  ffmpegStream = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  streamActive = true

  ffmpegStream.stdout.on('data', d => console.log('[FFmpeg stream]', d.toString()))
  ffmpegStream.stderr.on('data', d => {
    const msg = d.toString()
    // FFmpeg escreve progresso no stderr — só loga erros reais
    if (msg.includes('error') || msg.includes('Error')) {
      console.error('[FFmpeg stream]', msg)
    }
  })
  ffmpegStream.on('close', (code) => {
    console.log(`[FFmpeg stream] Processo encerrado (code=${code})`)
    streamActive  = false
    ffmpegStream  = null
  })
  ffmpegStream.on('error', (err) => {
    console.error('[FFmpeg stream] Erro ao iniciar:', err.message)
    streamActive = false
    ffmpegStream = null
  })

  console.log('[Stream] Iniciado para:', rtmpUrl)
  return true
}

// ─────────────────────────────────────────────
// PARAR STREAM
// ─────────────────────────────────────────────
function stopStream() {
  if (!ffmpegStream) return
  try {
    ffmpegStream.stdin.end()
    setTimeout(() => {
      if (ffmpegStream && !ffmpegStream.killed) ffmpegStream.kill('SIGTERM')
    }, 1500)
  } catch {}
  streamActive = false
  console.log('[Stream] Encerrado.')
}

// ─────────────────────────────────────────────
// ENVIAR FRAME PARA O STREAM
// Chamado pelo IPC a cada frame capturado da janela de saída
// ─────────────────────────────────────────────
function sendStreamFrame(buffer) {
  if (!ffmpegStream || !streamActive) return
  try {
    ffmpegStream.stdin.write(buffer)
  } catch (e) {
    console.warn('[Stream] Erro ao escrever frame:', e.message)
  }
}

// ─────────────────────────────────────────────
// INICIAR GRAVAÇÃO LOCAL
// ─────────────────────────────────────────────
function startRecording({ width = 1920, height = 1080, fps = 30, format = 'mp4' }) {
  if (recordActive) throw new Error('Gravação já está ativa.')

  const ffmpegPath = findFFmpeg()
  if (!ffmpegPath) throw new Error('FFmpeg não encontrado.')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outFile   = path.join(getRecordingsDir(), `gravacao_${timestamp}.${format}`)

  const args = [
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${width}x${height}`,
    '-framerate', String(fps),
    '-i', 'pipe:0',
    '-vcodec', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile
  ]

  ffmpegRecord = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  recordActive = true

  ffmpegRecord.stderr.on('data', d => {
    const msg = d.toString()
    if (msg.includes('error') || msg.includes('Error')) console.error('[FFmpeg record]', msg)
  })
  ffmpegRecord.on('close', (code) => {
    console.log(`[FFmpeg record] Finalizado (code=${code}): ${outFile}`)
    recordActive = false
    ffmpegRecord = null
  })
  ffmpegRecord.on('error', (err) => {
    console.error('[FFmpeg record] Erro:', err.message)
    recordActive = false
    ffmpegRecord = null
  })

  console.log('[Record] Gravando em:', outFile)
  return outFile
}

// ─────────────────────────────────────────────
// PARAR GRAVAÇÃO
// ─────────────────────────────────────────────
function stopRecording() {
  if (!ffmpegRecord) return
  try {
    ffmpegRecord.stdin.end()
    setTimeout(() => {
      if (ffmpegRecord && !ffmpegRecord.killed) ffmpegRecord.kill('SIGTERM')
    }, 2000)
  } catch {}
  recordActive = false
  console.log('[Record] Gravação encerrada.')
}

// ─────────────────────────────────────────────
// ENVIAR FRAME PARA GRAVAÇÃO
// ─────────────────────────────────────────────
function sendRecordFrame(buffer) {
  if (!ffmpegRecord || !recordActive) return
  try {
    ffmpegRecord.stdin.write(buffer)
  } catch (e) {
    console.warn('[Record] Erro ao escrever frame:', e.message)
  }
}

// ─────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────
function getStatus() {
  return {
    streamActive,
    recordActive,
    ffmpegFound: !!findFFmpeg(),
    recordingsDir: getRecordingsDir()
  }
}

// ─────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────
function cleanup() {
  stopStream()
  stopRecording()
}

module.exports = {
  startStream,
  stopStream,
  sendStreamFrame,
  startRecording,
  stopRecording,
  sendRecordFrame,
  getStatus,
  cleanup
}
