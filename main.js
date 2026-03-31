// ============================================================
// main.js — Processo principal do Electron
// NDI entrada e saída
// ============================================================

const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')

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

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  createControllerWindow()
  createAllOutputWindows()

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
  const buf = Buffer.from(frameData)
  stream.sendStreamFrame(buf)
})

// Recebe frame e envia para gravação FFmpeg
ipcMain.on('record-send-frame', (event, frameData) => {
  if (!stream) return
  const buf = Buffer.from(frameData)
  stream.sendRecordFrame(buf)
})

// Cleanup ao fechar
// (adicione dentro do handler 'before-quit' existente)
// if (stream) stream.cleanup()


// ─────────────────────────────────────────────
// Letras de Música (SQLite)
// ─────────────────────────────────────────────
let db = null
try {
  const Database = require('better-sqlite3')
  const path     = require('path')
  const { app }  = require('electron')
  const dbPath   = path.join(app.getPath('userData'), 'medialayers.db')
  db = new Database(dbPath)

  // Cria tabelas se não existirem
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
} catch (e) {
  console.warn('[DB] SQLite não disponível:', e.message)
}

// Buscar todas as músicas
ipcMain.handle('letras-get-all', () => {
  if (!db) return []
  return db.prepare('SELECT id, title, artist FROM songs ORDER BY title').all()
})

// Buscar uma música completa (com slides)
ipcMain.handle('letras-get', (event, id) => {
  if (!db) return null
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id)
  if (!row) return null
  return { ...row, slides: JSON.parse(row.slides || '[]') }
})

// Criar música
ipcMain.handle('letras-create', (event, { title, artist, slides }) => {
  if (!db) throw new Error('Banco não disponível.')
  const stmt   = db.prepare('INSERT INTO songs (title, artist, slides) VALUES (?, ?, ?)')
  const result = stmt.run(title, artist || '', JSON.stringify(slides || []))
  return { id: result.lastInsertRowid, title, artist, slides }
})

// Atualizar música
ipcMain.handle('letras-update', (event, { id, title, artist, slides }) => {
  if (!db) throw new Error('Banco não disponível.')
  db.prepare('UPDATE songs SET title = ?, artist = ?, slides = ? WHERE id = ?')
    .run(title, artist || '', JSON.stringify(slides || []), id)
  return true
})

// Deletar música
ipcMain.handle('letras-delete', (event, id) => {
  if (!db) return
  db.prepare('DELETE FROM songs WHERE id = ?').run(id)
})


// ─────────────────────────────────────────────
// Bíblia (SQLite + API fallback)
// ─────────────────────────────────────────────

// Busca de versículos: primeiro no SQLite local, depois API pública
ipcMain.handle('biblia-search', async (event, { type, book, chapter, verseStart, verseEnd, query, version }) => {
  // Tenta banco local primeiro
  if (db) {
    if (type === 'reference') {
      const vEnd = verseEnd || verseStart
      const rows = db.prepare(`
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
      const rows = db.prepare(`
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
        if (db) cacheVerses(db, version, results, book, chapter)
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

  return []
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

// Cleanup ao fechar
app.on('before-quit', async () => {
  if (ndi) {
    await ndi.stopAllReceivers()
    await ndi.stopSender()
  }
  if (stream) stream.cleanup()
})

