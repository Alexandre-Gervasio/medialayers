// ============================================================
// main.js — Processo principal do Electron
// NDI entrada e saída
// ============================================================

const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { autoUpdater } = require('electron-updater')

// NDI Manager — carregado com segurança (não quebra se grandiose não estiver instalado)
let ndi = null
try {
  ndi = require('./src/ndi/ndi-manager')
  console.log('[NDI] Módulo NDI carregado.')
} catch (e) {
  console.warn('[NDI] Módulo NDI não disponível:', e.message)
}

let controllerWindow = null
const outputWindows = {} // { displayId: BrowserWindow }
let remoteHttpServer = null
let remoteIo = null
let remoteControlInfo = { port: 3900, urls: [] }
let updateHandlersRegistered = false
const GITHUB_RELEASES_BASE_URL = 'https://github.com/Alexandre-Gervasio/medialayers/releases'
const BIBLE_BOOKS = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute',
  '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias',
  'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias',
  'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias',
  'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias', 'Mateus', 'Marcos', 'Lucas',
  'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios', 'Filipenses',
  'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito',
  'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'
]
const PUBLIC_BIBLE_SOURCES = {
  AA: {
    version: 'AA',
    label: 'Almeida Atualizada',
    sourceType: 'public-json',
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_aa.json'
  },
  ACF: {
    version: 'ACF',
    label: 'Almeida Corrigida Fiel',
    sourceType: 'public-json',
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_acf.json'
  }
}
const MANUAL_BIBLE_VERSIONS = {
  NVI: { version: 'NVI', label: 'Nova Versão Internacional' },
  ARA: { version: 'ARA', label: 'Almeida Revista e Atualizada' },
  NTLH: { version: 'NTLH', label: 'Nova Tradução na Linguagem de Hoje' },
  KJA: { version: 'KJA', label: 'King James Atualizada' }
}

const UPDATE_CONFIG_PATH = path.join(app.getPath('userData'), 'update-config.json')
const TELEMETRY_LOG_PATH = path.join(app.getPath('userData'), 'telemetry-errors.log')
const SESSION_STATE_PATH = path.join(app.getPath('userData'), 'session-state.json')
const DEFAULT_UPDATE_CONFIG = {
  feedUrl: '',
  autoCheck: true
}
let cachedSessionState = null
let controllerCloseConfirmed = false
const updateState = {
  configured: false,
  checking: false,
  available: false,
  downloaded: false,
  error: null,
  message: 'Atualizacao automatica nao configurada.',
  currentVersion: app.getVersion(),
  latestVersion: null,
  downloadProgress: null,
  lastCheckedAt: null,
  feedUrl: '',
  isPackaged: app.isPackaged
}
const telemetryState = {
  sessionStartedAt: new Date().toISOString(),
  items: []
}

function recordTelemetry(level, scope, message, meta = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    meta
  }

  telemetryState.items.unshift(entry)
  telemetryState.items = telemetryState.items.slice(0, 100)

  try {
    fs.appendFileSync(TELEMETRY_LOG_PATH, `${JSON.stringify(entry)}\n`)
  } catch (error) {
    console.warn('[Telemetry] Falha ao gravar log:', error.message)
  }

  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('telemetry-updated', {
      items: telemetryState.items,
      logPath: TELEMETRY_LOG_PATH,
      sessionStartedAt: telemetryState.sessionStartedAt
    })
  }
}

function getTelemetrySnapshot() {
  return {
    items: telemetryState.items,
    logPath: TELEMETRY_LOG_PATH,
    sessionStartedAt: telemetryState.sessionStartedAt
  }
}

function readSessionState() {
  try {
    if (!fs.existsSync(SESSION_STATE_PATH)) return null
    const parsed = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (error) {
    console.warn('[Session] Falha ao ler sessao:', error.message)
    return null
  }
}

function writeSessionState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null

  const payload = {
    ...snapshot,
    savedAt: new Date().toISOString()
  }

  fs.writeFileSync(SESSION_STATE_PATH, JSON.stringify(payload, null, 2))
  cachedSessionState = payload
  return payload
}

async function confirmControllerClose() {
  if (!controllerWindow || controllerWindow.isDestroyed()) return true

  if (process.env.MEDIALAYERS_DISABLE_CLOSE_PROMPT === '1') {
    controllerCloseConfirmed = true
    setImmediate(() => app.quit())
    return true
  }

  const response = await dialog.showMessageBox(controllerWindow, {
    type: 'question',
    buttons: ['Salvar e sair', 'Sair sem salvar', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    message: 'Deseja salvar?',
    detail: 'Mídias adicionadas, colunas, layers e o estado atual da aplicação serão preservados.'
  })

  if (response.response === 2) {
    return false
  }

  if (response.response === 0) {
    try {
      writeSessionState(cachedSessionState || readSessionState() || { version: 1 })
    } catch (error) {
      dialog.showErrorBox('Falha ao salvar sessão', error.message)
      return false
    }
  }

  controllerCloseConfirmed = true
  setImmediate(() => app.quit())
  return true
}

function isValidUpdateUrl(feedUrl) {
  if (!feedUrl) return { ok: true }

  try {
    const parsed = new URL(feedUrl)
    const isHttps = parsed.protocol === 'https:'
    const isGithub = parsed.hostname === 'github.com'
    const isLocalHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)

    if (isHttps || isGithub || (!app.isPackaged && isLocalHttp)) {
      return { ok: true, normalized: feedUrl.replace(/\/+$/, '') }
    }

    return {
      ok: false,
      reason: app.isPackaged
        ? 'Use uma URL HTTPS para atualizacoes em releases empacotadas.'
        : 'Use HTTPS ou um host local de desenvolvimento para testar updates.'
    }
  } catch {
    return { ok: false, reason: 'URL de atualizacao invalida.' }
  }
}

function buildRemoteControlUrls(port) {
  const urls = [{ label: 'Este computador', url: `http://localhost:${port}` }]
  const interfaces = os.networkInterfaces()

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== 'IPv4' || entry.internal) return
      urls.push({
        label: `Rede local (${entry.address})`,
        url: `http://${entry.address}:${port}`
      })
    })
  })

  return urls.filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
}

function broadcastRemoteControlInfo() {
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('remote-control-info', remoteControlInfo)
  }
}

function readUpdateConfig() {
  try {
    if (!fs.existsSync(UPDATE_CONFIG_PATH)) {
      return { ...DEFAULT_UPDATE_CONFIG }
    }

    const parsed = JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'))
    return {
      ...DEFAULT_UPDATE_CONFIG,
      ...parsed
    }
  } catch (error) {
    console.warn('[Updater] Falha ao ler configuracao:', error.message)
    return { ...DEFAULT_UPDATE_CONFIG }
  }
}

function writeUpdateConfig(config) {
  const nextConfig = {
    ...DEFAULT_UPDATE_CONFIG,
    ...config
  }

  fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(nextConfig, null, 2))
  return nextConfig
}

function updateUpdateState(patch) {
  Object.assign(updateState, patch)

  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('app-update-status', { ...updateState })
  }
}

function getConfiguredFeedUrl() {
  const config = readUpdateConfig()
  const feedUrl = String(process.env.MEDIALAYERS_UPDATE_URL || config.feedUrl || '').trim()
  return feedUrl.replace(/\/+$/, '')
}

function getDefaultUpdateProvider() {
  return {
    provider: 'github',
    owner: 'Alexandre-Gervasio',
    repo: 'medialayers'
  }
}

function configureAutoUpdater() {
  if (updateHandlersRegistered) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    updateUpdateState({
      checking: true,
      error: null,
      lastCheckedAt: new Date().toISOString(),
      message: 'Verificando atualizacoes...'
    })
  })

  autoUpdater.on('update-available', (info) => {
    updateUpdateState({
      checking: false,
      available: true,
      downloaded: false,
      latestVersion: info?.version || null,
      message: `Nova versao encontrada: ${info?.version || 'desconhecida'}. Baixando...`
    })
  })

  autoUpdater.on('update-not-available', () => {
    updateUpdateState({
      checking: false,
      available: false,
      downloaded: false,
      latestVersion: null,
      message: 'Voce ja esta na versao mais recente.'
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    updateUpdateState({
      downloadProgress: progress.percent,
      message: `Baixando atualizacao: ${Math.round(progress.percent)}%`
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateUpdateState({
      checking: false,
      available: true,
      downloaded: true,
      latestVersion: info?.version || null,
      message: `Atualizacao ${info?.version || ''} pronta para instalar.`.trim(),
      downloadProgress: 100
    })
  })

  autoUpdater.on('error', (error) => {
    recordTelemetry('error', 'updater', error.message, { stack: error.stack })
    updateUpdateState({
      checking: false,
      error: error.message,
      message: `Falha no auto-update: ${error.message}`
    })
  })

  updateHandlersRegistered = true
}

async function checkForAppUpdates() {
  if (updateState.checking) {
    return { ok: false, reason: 'already-checking' }
  }

  const feedUrl = getConfiguredFeedUrl()
  const usingDefaultGithubFeed = !feedUrl
  const validation = isValidUpdateUrl(feedUrl)

  updateUpdateState({
    configured: true,
    feedUrl: feedUrl || GITHUB_RELEASES_BASE_URL,
    isPackaged: app.isPackaged,
    currentVersion: app.getVersion()
  })

  if (!app.isPackaged) {
    updateUpdateState({
      checking: false,
      message: 'Auto-update desativado em desenvolvimento. Gere uma release empacotada para testar.'
    })
    return { ok: false, reason: 'not-packaged' }
  }

  if (!validation.ok) {
    updateUpdateState({
      checking: false,
      configured: false,
      error: validation.reason,
      message: validation.reason
    })
    return { ok: false, reason: 'invalid-feed-url' }
  }

  if (usingDefaultGithubFeed) {
    autoUpdater.setFeedURL(getDefaultUpdateProvider())
    updateUpdateState({
      message: 'Verificando atualizacoes no GitHub Releases...'
    })
  } else {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
    updateUpdateState({
      message: `Verificando atualizacoes em ${feedUrl}...`
    })
  }

  await autoUpdater.checkForUpdates()
  return { ok: true }
}

// ─────────────────────────────────────────────
// Janela de CONTROLE
// ─────────────────────────────────────────────
function createControllerWindow() {
  controllerWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MediaLayers — Controle',
    backgroundColor: '#0d0d1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  controllerWindow.loadFile(path.join(__dirname, 'src/controller/index-daw.html'))

  controllerWindow.on('close', async (event) => {
    if (controllerCloseConfirmed) return
    event.preventDefault()
    await confirmControllerClose()
  })

  controllerWindow.webContents.on('render-process-gone', (event, details) => {
    recordTelemetry('error', 'controller', 'Renderer de controle encerrado inesperadamente.', details)
  })

  controllerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    recordTelemetry('error', 'controller', 'Falha ao carregar interface de controle.', {
      errorCode,
      errorDescription
    })
  })
}

// ─────────────────────────────────────────────
// Janela de SAÍDA para um display específico
// ─────────────────────────────────────────────
function createOutputWindow(display) {
  const { id, bounds } = display
  const isSecondary = bounds.x !== 0 || bounds.y !== 0

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: `MediaLayers — Saída (Monitor ${id})`,
    backgroundColor: '#000000',
    frame: false,
    fullscreen: isSecondary,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, 'src/output/index.html'))
  win.displayId = id
  outputWindows[id] = win

  win.webContents.on('render-process-gone', (event, details) => {
    recordTelemetry('error', 'output', `Renderer de saída do monitor ${id} encerrado inesperadamente.`, details)
  })

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    recordTelemetry('error', 'output', `Falha ao carregar janela de saída ${id}.`, {
      errorCode,
      errorDescription
    })
  })

  // Quando a janela de saída fechar, remove do registro
  win.on('closed', () => {
    delete outputWindows[id]
  })

  return win
}

// ─────────────────────────────────────────────
// Criar saídas para todos os monitores
// ─────────────────────────────────────────────
function createAllOutputWindows() {
  const displays = screen.getAllDisplays()
  // Pula o monitor principal (onde está o controle)
  const secondaryDisplays = displays.length > 1
    ? displays.filter(d => d.bounds.x !== 0 || d.bounds.y !== 0)
    : [displays[0]] // se só tiver um monitor, abre nele mesmo

  secondaryDisplays.forEach(display => createOutputWindow(display))
}

function startRemoteControlServer() {
  if (remoteHttpServer) return

  const remoteApp = express()
  const httpServer = createServer(remoteApp)
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })

  remoteApp.get('/health', (req, res) => {
    res.json({ ok: true, service: 'medialayers-remote' })
  })

  remoteApp.get('/', (req, res) => {
    res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MediaLayers Remote</title>
    <style>
      body { margin:0; font-family:Segoe UI,Tahoma,sans-serif; background:#0f172a; color:#e2e8f0; }
      .wrap { max-width:480px; margin:0 auto; padding:20px; }
      h1 { font-size:18px; margin:0 0 14px; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      button { background:#1d4ed8; color:#fff; border:0; border-radius:8px; padding:14px; font-size:14px; }
      button.alt { background:#334155; }
      button.warn { background:#b45309; }
      .status { margin-top:12px; color:#93c5fd; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>MediaLayers Remote</h1>
      <div class="grid">
        <button data-cmd="prev">Anterior</button>
        <button data-cmd="next">Próximo</button>
        <button data-cmd="take">TAKE</button>
        <button class="warn" data-cmd="clear">CLEAR</button>
      </div>
      <div class="status" id="status">Conectando...</div>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const status = document.getElementById('status');
      socket.on('connect', () => { status.textContent = 'Conectado'; });
      socket.on('disconnect', () => { status.textContent = 'Desconectado'; });
      document.querySelectorAll('button[data-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          socket.emit('remote:command', { type: btn.dataset.cmd });
        });
      });
    </script>
  </body>
</html>`)
  })

  io.on('connection', (socket) => {
    socket.on('remote:command', (command) => {
      if (!controllerWindow || controllerWindow.isDestroyed()) return
      controllerWindow.webContents.send('remote-control-command', command)
    })
  })

  const port = Number(process.env.MEDIALAYERS_REMOTE_PORT || 3900)
  httpServer.listen(port, '0.0.0.0', () => {
    remoteControlInfo = {
      port,
      urls: buildRemoteControlUrls(port)
    }
    console.log(`[Remote] Controle remoto ativo em http://localhost:${port}`)
    broadcastRemoteControlInfo()
  })

  remoteHttpServer = httpServer
  remoteIo = io
}

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  configureAutoUpdater()
  createControllerWindow()
  createAllOutputWindows()
  startRemoteControlServer()

  const updateConfig = readUpdateConfig()
  const feedUrl = getConfiguredFeedUrl()
  updateUpdateState({
    configured: Boolean(feedUrl),
    feedUrl,
    isPackaged: app.isPackaged,
    currentVersion: app.getVersion(),
    message: feedUrl
      ? 'Auto-update configurado. Pronto para verificar atualizacoes.'
      : 'Configure a URL de updates para habilitar atualizacao automatica.'
  })

  if (updateConfig.autoCheck) {
    setTimeout(() => {
      checkForAppUpdates().catch((error) => {
        updateUpdateState({
          checking: false,
          error: error.message,
          message: `Falha ao verificar atualizacoes: ${error.message}`
        })
      })
    }, 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControllerWindow()
      createAllOutputWindows()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (error) => {
  recordTelemetry('fatal', 'main', error.message, { stack: error.stack })
})

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  recordTelemetry('error', 'main', message, { stack })
})

// ─────────────────────────────────────────────
// IPC — Comunicação entre janelas
// ─────────────────────────────────────────────

// Envia comando para UMA saída específica ou TODAS
// payload.targetDisplay = id do display, ou 'all'
ipcMain.on('send-to-output', (event, payload) => {
  const target = payload.targetDisplay

  if (!target || target === 'all') {
    // Envia para todas as saídas
    Object.values(outputWindows).forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('receive-command', payload)
      }
    })
  } else {
    // Envia para uma saída específica
    const win = outputWindows[target]
    if (win && !win.isDestroyed()) {
      win.webContents.send('receive-command', payload)
    }
  }
})

// Retorna a lista de monitores para o painel de controle
ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id:     d.id,
    width:  d.bounds.width,
    height: d.bounds.height,
    x:      d.bounds.x,
    y:      d.bounds.y,
    isPrimary: d.bounds.x === 0 && d.bounds.y === 0
  }))
})

ipcMain.handle('get-remote-control-info', () => remoteControlInfo)

ipcMain.handle('app-update-get-config', () => {
  const config = readUpdateConfig()
  const feedUrl = getConfiguredFeedUrl()
  return {
    ...config,
    isPackaged: app.isPackaged,
    currentVersion: app.getVersion(),
    effectiveFeedUrl: feedUrl,
    state: { ...updateState }
  }
})

ipcMain.handle('app-update-set-config', (event, config) => {
  const nextConfig = writeUpdateConfig(config || {})
  const feedUrl = getConfiguredFeedUrl()
  const validation = isValidUpdateUrl(feedUrl)

  updateUpdateState({
    configured: Boolean(feedUrl) && validation.ok,
    feedUrl,
    error: validation.ok ? null : validation.reason,
    message: !feedUrl
      ? 'URL de update vazia. Auto-update desativado.'
      : validation.ok
      ? 'Configuracao de update salva.'
      : validation.reason
  })

  return {
    ...nextConfig,
    effectiveFeedUrl: feedUrl,
    state: { ...updateState }
  }
})

ipcMain.handle('app-update-check', async () => checkForAppUpdates())

ipcMain.handle('app-update-install', async () => {
  if (!updateState.downloaded) {
    return { ok: false, reason: 'not-downloaded' }
  }

  setImmediate(() => autoUpdater.quitAndInstall())
  return { ok: true }
})

ipcMain.handle('telemetry-get-state', () => getTelemetrySnapshot())

ipcMain.handle('session-load-state', () => {
  cachedSessionState = cachedSessionState || readSessionState()
  return cachedSessionState
})

ipcMain.handle('session-save-state', (event, snapshot) => {
  return writeSessionState(snapshot)
})

ipcMain.on('session-cache-state', (event, snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return
  cachedSessionState = snapshot
})

ipcMain.on('telemetry-report-error', (event, payload = {}) => {
  recordTelemetry(payload.level || 'error', payload.scope || 'renderer', payload.message || 'Erro sem mensagem', {
    stack: payload.stack,
    extra: payload.extra,
    sender: event.senderFrame?.url || 'unknown'
  })
})

// Abre uma janela de saída para um display específico
ipcMain.handle('open-output', (event, displayId) => {
  if (outputWindows[displayId]) return // já existe
  const displays = screen.getAllDisplays()
  const display  = displays.find(d => d.id === displayId)
  if (display) createOutputWindow(display)
})

// Fecha uma janela de saída específica
ipcMain.handle('close-output', (event, displayId) => {
  const win = outputWindows[displayId]
  if (win && !win.isDestroyed()) win.close()
})

// Janela de saída pronta
ipcMain.on('output-ready', (event) => {
  console.log('[MediaLayers] Janela de saída pronta.')
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('outputs-updated', Object.keys(outputWindows).map(Number))
  }
})

// ─────────────────────────────────────────────
// IPC — NDI
// ─────────────────────────────────────────────

// Verifica se NDI está disponível
ipcMain.handle('ndi-available', () => {
  return ndi ? ndi.isAvailable() : false
})

// Busca fontes NDI na rede
ipcMain.handle('ndi-find-sources', async () => {
  if (!ndi) return []
  return await ndi.findSources(3000)
})

// Inicia recepção de uma fonte NDI como camada
ipcMain.handle('ndi-start-receiver', async (event, { layerId, sourceIndex }) => {
  if (!ndi) throw new Error('NDI não disponível')
  await ndi.startReceiver(layerId, sourceIndex, (id, frame) => {
    if (controllerWindow && !controllerWindow.isDestroyed()) {
      controllerWindow.webContents.send('ndi-frame', {
        layerId: id,
        frame: { xres: frame.xres, yres: frame.yres, data: frame.data }
      })
    }

    Object.values(outputWindows).forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('ndi-frame', {
          layerId: id,
          frame: { xres: frame.xres, yres: frame.yres, data: frame.data }
        })
      }
    })
  })
})

// Para receiver NDI de uma camada
ipcMain.handle('ndi-stop-receiver', async (event, layerId) => {
  if (!ndi) return
  await ndi.stopReceiver(layerId)
})

// Inicia sender NDI (publica a saída na rede)
ipcMain.handle('ndi-start-sender', async (event, sourceName) => {
  if (!ndi) throw new Error('Módulo NDI não carregado')
  await ndi.startSender(sourceName || 'MediaLayers')
})

// Para sender NDI
ipcMain.handle('ndi-stop-sender', async () => {
  if (!ndi) return
  await ndi.stopSender()
})

// Recebe frame capturado da janela de saída e publica via NDI
ipcMain.on('ndi-output-frame', async (event, { width, height, layerId, data }) => {
  if (!ndi) {
    console.warn('[NDI] NDI module not available, skipping output frame')
    return
  }

  const buf = Buffer.from(data)

  if (typeof ndi.sendFrame === 'function') {
    try {
      console.log(`[NDI] output frame layer=${layerId} ${width}x${height} (${buf.length} bytes)`)
      await ndi.sendFrame(width, height, buf)
    } catch (err) {
      console.error('[NDI] sendFrame erro:', err)
    }
  } else {
    console.warn('[NDI] sendFrame não implementado no ndi-manager')
  }
})

// Captura frame da janela de saída atual em RGBA raw
ipcMain.handle('capture-output-frame', async (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  const fallbackWindow = Object.values(outputWindows).find(win => win && !win.isDestroyed())
  const win = senderWindow && !senderWindow.isDestroyed() ? senderWindow : fallbackWindow

  if (!win) return null

  try {
    const image = await win.webContents.capturePage()
    const size = image.getSize()
    const bitmap = image.toBitmap()

    return {
      width: size.width,
      height: size.height,
      data: Array.from(bitmap)
    }
  } catch (e) {
    console.warn('[Capture] Erro ao capturar frame:', e.message)
    return null
  }
})

// ─────────────────────────────────────────────
// Stream e Gravação com FFmpeg
// ─────────────────────────────────────────────
let stream = null
try {
  stream = require('./src/stream/stream-manager')
  console.log('[Stream] Módulo carregado.')
} catch (e) {
  console.warn('[Stream] Módulo não disponível:', e.message)
}

// Status do stream/gravação
ipcMain.handle('stream-get-status', () => {
  return stream ? stream.getStatus() : { streamActive: false, recordActive: false, ffmpegFound: false }
})

// Iniciar stream RTMP
ipcMain.handle('stream-start', (event, config) => {
  if (!stream) throw new Error('Módulo de stream não carregado.')
  return stream.startStream(config)
})

// Parar stream
ipcMain.handle('stream-stop', () => {
  if (stream) stream.stopStream()
})

// Iniciar gravação
ipcMain.handle('record-start', (event, config) => {
  if (!stream) throw new Error('Módulo de stream não carregado.')
  return stream.startRecording(config)
})

// Parar gravação
ipcMain.handle('record-stop', () => {
  if (stream) stream.stopRecording()
})

// Recebe frame do renderer e envia para o stream FFmpeg
ipcMain.on('stream-send-frame', (event, frameData) => {
  if (!stream) return
  const buf = Buffer.from(frameData?.data || frameData)
  stream.sendStreamFrame(buf)
})

// Recebe frame e envia para gravação FFmpeg
ipcMain.on('record-send-frame', (event, frameData) => {
  if (!stream) return
  const buf = Buffer.from(frameData?.data || frameData)
  stream.sendRecordFrame(buf)
})

// Cleanup ao fechar
// (adicione dentro do handler 'before-quit' existente)
// if (stream) stream.cleanup()


// ─────────────────────────────────────────────
// Letras de Música (SQLite)
// ─────────────────────────────────────────────
let db = null
let dbInitAttempted = false
let dbFallbackNoticeShown = false

function getSongsFallbackPath() {
  return path.join(app.getPath('userData'), 'songs-library.json')
}

function readSongsFallback() {
  try {
    const fallbackPath = getSongsFallbackPath()
    if (!fs.existsSync(fallbackPath)) return []

    const parsed = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('[DB] Falha ao ler biblioteca JSON:', error.message)
    return []
  }
}

function writeSongsFallback(songs) {
  fs.writeFileSync(getSongsFallbackPath(), JSON.stringify(songs, null, 2))
}

function showDbFallbackNotice(error) {
  if (dbFallbackNoticeShown) return
  dbFallbackNoticeShown = true
  console.log(`[DB] SQLite indisponivel neste ambiente; usando biblioteca JSON local. Motivo: ${error.message}`)
}

function ensureDatabase() {
  if (dbInitAttempted) return db
  dbInitAttempted = true

  try {
    const Database = require('better-sqlite3')
    const dbPath = path.join(app.getPath('userData'), 'medialayers.db')
    db = new Database(dbPath)

    db.exec(`
      CREATE TABLE IF NOT EXISTS songs (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        title   TEXT NOT NULL,
        artist  TEXT,
        slides  TEXT NOT NULL DEFAULT '[]',
        created INTEGER DEFAULT (strftime('%s','now'))
      );
      CREATE TABLE IF NOT EXISTS bible_verses (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        book    TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse   INTEGER NOT NULL,
        text    TEXT NOT NULL,
        UNIQUE(version, book, chapter, verse)
      );
      CREATE INDEX IF NOT EXISTS idx_bible ON bible_verses(version, book, chapter, verse);
      CREATE INDEX IF NOT EXISTS idx_bible_text ON bible_verses(text);
    `)

    console.log('[DB] SQLite iniciado:', dbPath)
    return db
  } catch (error) {
    db = null
    showDbFallbackNotice(error)
    return null
  }
}

// Buscar todas as músicas
ipcMain.handle('letras-get-all', () => {
  const database = ensureDatabase()
  if (!database) {
    return readSongsFallback()
      .slice()
      .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'))
      .map(({ id, title, artist }) => ({ id, title, artist }))
  }

  return database.prepare('SELECT id, title, artist FROM songs ORDER BY title').all()
})

// Buscar uma música completa (com slides)
ipcMain.handle('letras-get', (event, id) => {
  const database = ensureDatabase()
  if (!database) {
    return readSongsFallback().find((song) => String(song.id) === String(id)) || null
  }

  const row = database.prepare('SELECT * FROM songs WHERE id = ?').get(id)
  if (!row) return null
  return { ...row, slides: JSON.parse(row.slides || '[]') }
})

// Criar música
ipcMain.handle('letras-create', (event, { title, artist, slides }) => {
  const database = ensureDatabase()
  if (!database) {
    const songs = readSongsFallback()
    const nextId = songs.reduce((maxId, song) => Math.max(maxId, Number(song.id) || 0), 0) + 1
    const createdSong = {
      id: nextId,
      title,
      artist: artist || '',
      slides: Array.isArray(slides) ? slides : [],
      created: Math.floor(Date.now() / 1000)
    }

    songs.push(createdSong)
    writeSongsFallback(songs)
    return createdSong
  }

  const stmt = database.prepare('INSERT INTO songs (title, artist, slides) VALUES (?, ?, ?)')
  const result = stmt.run(title, artist || '', JSON.stringify(slides || []))
  return { id: result.lastInsertRowid, title, artist, slides }
})

// Atualizar música
ipcMain.handle('letras-update', (event, { id, title, artist, slides }) => {
  const database = ensureDatabase()
  if (!database) {
    const songs = readSongsFallback()
    const songIndex = songs.findIndex((song) => String(song.id) === String(id))
    if (songIndex === -1) throw new Error('Musica nao encontrada.')

    songs[songIndex] = {
      ...songs[songIndex],
      title,
      artist: artist || '',
      slides: Array.isArray(slides) ? slides : []
    }

    writeSongsFallback(songs)
    return true
  }

  database.prepare('UPDATE songs SET title = ?, artist = ?, slides = ? WHERE id = ?')
    .run(title, artist || '', JSON.stringify(slides || []), id)
  return true
})

// Deletar música
ipcMain.handle('letras-delete', (event, id) => {
  const database = ensureDatabase()
  if (!database) {
    const songs = readSongsFallback().filter((song) => String(song.id) !== String(id))
    writeSongsFallback(songs)
    return true
  }

  database.prepare('DELETE FROM songs WHERE id = ?').run(id)
  return true
})


// ─────────────────────────────────────────────
// Bíblia (SQLite + API fallback)
// ─────────────────────────────────────────────

// Busca de versículos: primeiro no SQLite local, depois API pública
ipcMain.handle('biblia-search', async (event, { type, book, chapter, verseStart, verseEnd, query, version }) => {
  const database = ensureDatabase()
  // Tenta banco local primeiro
  if (database) {
    if (type === 'reference') {
      const vEnd = verseEnd || verseStart
      const rows = database.prepare(`
        SELECT book, chapter, verse, text
        FROM bible_verses
        WHERE version = ? AND book = ? AND chapter = ? AND verse BETWEEN ? AND ?
        ORDER BY verse
      `).all(version || 'NVI', book, chapter, verseStart, vEnd)

      if (rows.length > 0) {
        return rows.map(r => ({
          ref:  `${r.book} ${r.chapter}:${r.verse}`,
          text: r.text
        }))
      }
    }

    if (type === 'text' && query) {
      const rows = database.prepare(`
        SELECT book, chapter, verse, text
        FROM bible_verses
        WHERE version = ? AND text LIKE ?
        LIMIT 50
      `).all(version || 'NVI', `%${query}%`)

      if (rows.length > 0) {
        return rows.map(r => ({
          ref:  `${r.book} ${r.chapter}:${r.verse}`,
          text: r.text
        }))
      }
    }
  }

  // Fallback: API pública bible-api.com (gratuita, sem autenticação)
  try {
    const https = require('https')

    const versionMap = { NVI: 'nvi', ARA: 'almeida', ACF: 'acf', NTLH: 'ntlh', KJA: 'kjv' }
    const apiVersion = versionMap[version] || 'nvi'

    if (type === 'reference') {
      const vEnd = verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ''
      // Converte nome do livro PT → abreviação para a API
      const bookAbbr = ptBookToAbbr(book)
      const url = `https://bible-api.com/${encodeURIComponent(bookAbbr)}+${chapter}:${verseStart}${vEnd}?translation=${apiVersion}`

      const data = await httpGet(url)
      const json = JSON.parse(data)

      if (json.verses) {
        const results = json.verses.map(v => ({
          ref:  `${book} ${v.chapter}:${v.verse}`,
          text: v.text.trim()
        }))
        // Salva no banco local para cache
        if (database) cacheVerses(database, version, results, book, chapter)
        return results
      }
    }

    if (type === 'text' && query) {
      // bible-api.com não tem busca por texto — retorna aviso
      return [{
        ref:  'Dica',
        text: `A busca por texto requer o banco bíblico local. Importe um arquivo .db de versículos para usar offline.`
      }]
    }
  } catch (e) {
    console.warn('[Bíblia] Erro na API:', e.message)
  }

  const fallbackResults = getBuiltinBibleFallback({ type, book, chapter, verseStart, verseEnd, query, version })
  if (fallbackResults.length) {
    return fallbackResults
  }

  return []
})

ipcMain.handle('biblia-list-versions', () => {
  return getBibleCatalog()
})

ipcMain.handle('biblia-download', async (event, version) => {
  const normalizedVersion = normalizeBibleVersion(version)
  const database = ensureDatabase()
  if (!database) {
    throw new Error('SQLite indisponível neste ambiente; não foi possível baixar a Bíblia offline.')
  }

  const versionsToDownload = normalizedVersion === 'ALL-PUBLIC'
    ? Object.keys(PUBLIC_BIBLE_SOURCES)
    : [normalizedVersion]

  const results = []

  for (const currentVersion of versionsToDownload) {
    const source = PUBLIC_BIBLE_SOURCES[currentVersion]
    if (!source) {
      throw new Error(`A versão ${currentVersion} não possui fonte pública integrada. Use a importação manual.`)
    }

    sendBibleProgress({ stage: 'baixando', version: currentVersion, message: `Baixando ${source.label}...` })
    const payload = await httpGet(source.url)
    const parsed = JSON.parse(payload)

    const result = importBibleJsonPayload(database, currentVersion, parsed, (progress) => {
      sendBibleProgress({
        ...progress,
        message: `Importando ${source.label}: livro ${progress.processedBooks}/${progress.totalBooks}`
      })
    })

    sendBibleProgress({
      stage: 'concluido',
      version: currentVersion,
      verseCount: result.verseCount,
      message: `${source.label} disponível offline.`
    })

    results.push(result)
  }

  return normalizedVersion === 'ALL-PUBLIC' ? results : results[0]
})

ipcMain.handle('biblia-import-json', async (event, version) => {
  const normalizedVersion = normalizeBibleVersion(version)
  const database = ensureDatabase()
  if (!database) {
    throw new Error('SQLite indisponível neste ambiente; não foi possível importar a Bíblia offline.')
  }

  const response = await dialog.showOpenDialog(controllerWindow, {
    title: `Importar Bíblia ${normalizedVersion}`,
    filters: [{ name: 'JSON bíblico', extensions: ['json'] }],
    properties: ['openFile']
  })

  if (response.canceled || !response.filePaths?.length) {
    return { canceled: true }
  }

  const selectedPath = response.filePaths[0]
  const payload = JSON.parse(fs.readFileSync(selectedPath, 'utf8'))
  sendBibleProgress({ stage: 'importando', version: normalizedVersion, message: `Importando ${path.basename(selectedPath)}...` })
  const result = importBibleJsonPayload(database, normalizedVersion, payload, (progress) => {
    sendBibleProgress({
      ...progress,
      message: `Importando ${normalizedVersion}: livro ${progress.processedBooks}/${progress.totalBooks}`
    })
  })
  sendBibleProgress({
    stage: 'concluido',
    version: normalizedVersion,
    verseCount: result.verseCount,
    message: `${normalizedVersion} importada com sucesso.`
  })

  return {
    ...result,
    filePath: selectedPath,
    canceled: false
  }
})

// ─── Helpers internos ────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const https = require('https')
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function cacheVerses(db, version, verses, book, chapter) {
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO bible_verses (version, book, chapter, verse, text)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((rows) => {
      rows.forEach(v => {
        const parts = v.ref.split(' ')
        const verseNum = parseInt(parts[parts.length - 1].split(':')[1])
        stmt.run(version, book, chapter, verseNum, v.text)
      })
    })
    insertMany(verses)
  } catch {}
}

function sendBibleProgress(payload) {
  if (!controllerWindow || controllerWindow.isDestroyed()) return
  controllerWindow.webContents.send('biblia-download-progress', payload)
}

function normalizeBibleVersion(version) {
  return String(version || '').trim().toUpperCase()
}

function getBibleCatalog(database = ensureDatabase()) {
  const countsByVersion = {}

  if (database) {
    database.prepare(`
      SELECT version, COUNT(*) AS verseCount
      FROM bible_verses
      GROUP BY version
    `).all().forEach((row) => {
      countsByVersion[normalizeBibleVersion(row.version)] = Number(row.verseCount || 0)
    })
  }

  const publicEntries = Object.values(PUBLIC_BIBLE_SOURCES).map((source) => {
    const verseCount = countsByVersion[source.version] || 0
    return {
      version: source.version,
      label: source.label,
      downloadable: true,
      importable: true,
      sourceType: source.sourceType,
      verseCount,
      isOfflineReady: verseCount > 30000
    }
  })

  const manualEntries = Object.values(MANUAL_BIBLE_VERSIONS).map((source) => {
    const verseCount = countsByVersion[source.version] || 0
    return {
      version: source.version,
      label: source.label,
      downloadable: false,
      importable: true,
      sourceType: 'manual-import',
      verseCount,
      isOfflineReady: verseCount > 30000
    }
  })

  const importedOnly = Object.entries(countsByVersion)
    .filter(([version]) => !PUBLIC_BIBLE_SOURCES[version] && !MANUAL_BIBLE_VERSIONS[version])
    .map(([version, verseCount]) => ({
      version,
      label: version,
      downloadable: false,
      importable: true,
      sourceType: 'imported',
      verseCount,
      isOfflineReady: verseCount > 30000
    }))

  return [...publicEntries, ...manualEntries, ...importedOnly]
}

function normalizeBibleJsonBooks(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Formato de JSON bíblico inválido.')
  }

  return payload.map((bookEntry, bookIndex) => {
    const chapters = Array.isArray(bookEntry?.chapters) ? bookEntry.chapters : []
    return {
      book: BIBLE_BOOKS[bookIndex] || String(bookEntry?.name || bookEntry?.abbrev || `Livro ${bookIndex + 1}`),
      chapters
    }
  })
}

function importBibleJsonPayload(database, version, payload, progressCallback = null) {
  if (!database) {
    throw new Error('SQLite indisponível neste ambiente; não foi possível importar a Bíblia offline.')
  }

  const normalizedVersion = normalizeBibleVersion(version)
  const books = normalizeBibleJsonBooks(payload)
  const insertVerse = database.prepare(`
    INSERT OR REPLACE INTO bible_verses (version, book, chapter, verse, text)
    VALUES (?, ?, ?, ?, ?)
  `)
  const deleteVersion = database.prepare('DELETE FROM bible_verses WHERE version = ?')

  let verseCount = 0
  const importTransaction = database.transaction(() => {
    deleteVersion.run(normalizedVersion)

    books.forEach((bookEntry, bookIndex) => {
      bookEntry.chapters.forEach((chapterVerses, chapterIndex) => {
        if (!Array.isArray(chapterVerses)) return

        chapterVerses.forEach((verseText, verseIndex) => {
          const normalizedText = String(verseText || '').trim()
          if (!normalizedText) return

          insertVerse.run(
            normalizedVersion,
            bookEntry.book,
            chapterIndex + 1,
            verseIndex + 1,
            normalizedText
          )
          verseCount += 1
        })
      })

      if (progressCallback) {
        progressCallback({
          stage: 'importando',
          version: normalizedVersion,
          processedBooks: bookIndex + 1,
          totalBooks: books.length,
          verseCount
        })
      }
    })
  })

  importTransaction()

  return {
    version: normalizedVersion,
    importedBooks: books.length,
    verseCount
  }
}

// Mapa simplificado de nomes PT para abreviações da bible-api.com
function ptBookToAbbr(book) {
  const map = {
    'Gênesis': 'genesis', 'Êxodo': 'exodus', 'Levítico': 'leviticus',
    'Números': 'numbers', 'Deuteronômio': 'deuteronomy', 'Josué': 'joshua',
    'Juízes': 'judges', 'Rute': 'ruth', '1 Samuel': '1 samuel', '2 Samuel': '2 samuel',
    '1 Reis': '1 kings', '2 Reis': '2 kings', '1 Crônicas': '1 chronicles',
    '2 Crônicas': '2 chronicles', 'Esdras': 'ezra', 'Neemias': 'nehemiah',
    'Ester': 'esther', 'Jó': 'job', 'Salmos': 'psalms', 'Provérbios': 'proverbs',
    'Eclesiastes': 'ecclesiastes', 'Cantares': 'song of solomon', 'Isaías': 'isaiah',
    'Jeremias': 'jeremiah', 'Lamentações': 'lamentations', 'Ezequiel': 'ezekiel',
    'Daniel': 'daniel', 'Oséias': 'hosea', 'Joel': 'joel', 'Amós': 'amos',
    'Obadias': 'obadiah', 'Jonas': 'jonah', 'Miquéias': 'micah', 'Naum': 'nahum',
    'Habacuque': 'habakkuk', 'Sofonias': 'zephaniah', 'Ageu': 'haggai',
    'Zacarias': 'zechariah', 'Malaquias': 'malachi',
    'Mateus': 'matthew', 'Marcos': 'mark', 'Lucas': 'luke', 'João': 'john',
    'Atos': 'acts', 'Romanos': 'romans', '1 Coríntios': '1 corinthians',
    '2 Coríntios': '2 corinthians', 'Gálatas': 'galatians', 'Efésios': 'ephesians',
    'Filipenses': 'philippians', 'Colossenses': 'colossians',
    '1 Tessalonicenses': '1 thessalonians', '2 Tessalonicenses': '2 thessalonians',
    '1 Timóteo': '1 timothy', '2 Timóteo': '2 timothy', 'Tito': 'titus',
    'Filemom': 'philemon', 'Hebreus': 'hebrews', 'Tiago': 'james',
    '1 Pedro': '1 peter', '2 Pedro': '2 peter', '1 João': '1 john',
    '2 João': '2 john', '3 João': '3 john', 'Judas': 'jude', 'Apocalipse': 'revelation'
  }
  return map[book] || book.toLowerCase()
}

function getBuiltinBibleFallback({ type, book, chapter, verseStart, verseEnd, query, version }) {
  const fallbackVerses = [
    {
      version: 'NVI',
      book: 'João',
      chapter: 3,
      verse: 16,
      text: 'Porque Deus tanto amou o mundo que deu o seu Filho Unigênito, para que todo o que nele crer não pereça, mas tenha a vida eterna.'
    },
    {
      version: 'ARA',
      book: 'João',
      chapter: 3,
      verse: 16,
      text: 'Porque Deus amou ao mundo de tal maneira que deu o seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna.'
    },
    {
      version: 'NVI',
      book: 'Salmos',
      chapter: 23,
      verse: 1,
      text: 'O Senhor é o meu pastor; de nada terei falta.'
    }
  ]

  if (type === 'reference') {
    const upperVerseEnd = verseEnd || verseStart
    return fallbackVerses
      .filter((item) => item.version === (version || 'NVI'))
      .filter((item) => item.book === book)
      .filter((item) => item.chapter === Number(chapter))
      .filter((item) => item.verse >= Number(verseStart) && item.verse <= Number(upperVerseEnd))
      .map((item) => ({ ref: `${item.book} ${item.chapter}:${item.verse}`, text: item.text }))
  }

  if (type === 'text' && query) {
    const normalizedQuery = String(query).toLowerCase()
    return fallbackVerses
      .filter((item) => item.version === (version || 'NVI'))
      .filter((item) => item.text.toLowerCase().includes(normalizedQuery))
      .map((item) => ({ ref: `${item.book} ${item.chapter}:${item.verse}`, text: item.text }))
  }

  return []
}

// Cleanup ao fechar
app.on('before-quit', async () => {
  controllerCloseConfirmed = true
  if (ndi) {
    await ndi.stopAllReceivers()
    await ndi.stopSender()
  }
  if (stream) stream.cleanup()
  if (remoteIo) remoteIo.close()
  if (remoteHttpServer) remoteHttpServer.close()
})

