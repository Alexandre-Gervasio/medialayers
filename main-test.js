// ============================================================
// main-test.js — Versão simplificada para testar Golden Layout
// ============================================================

const { app, BrowserWindow } = require('electron')
const path = require('path')

let controllerWindow = null

function createControllerWindow() {
  console.log('🚀 Creating controller window...')

  controllerWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MediaLayers — Teste Golden Layout',
    backgroundColor: '#0d0d1a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const htmlPath = path.join(__dirname, 'src/controller/index-daw.html')
  console.log('📁 Loading HTML file:', htmlPath)

  controllerWindow.loadFile(htmlPath)

  controllerWindow.webContents.on('did-finish-load', () => {
    console.log('✅ HTML loaded successfully')
  })

  controllerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load HTML:', errorCode, errorDescription)
  })

  controllerWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CONSOLE] ${message}`)
  })

  // Abrir DevTools para debug
  controllerWindow.webContents.openDevTools()

  controllerWindow.on('closed', () => {
    console.log('🪟 Window closed')
    controllerWindow = null
  })
}

app.whenReady().then(() => {
  console.log('🎬 App ready, creating window...')
  createControllerWindow()
})

app.on('window-all-closed', () => {
  console.log('🪟 All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  console.log('📱 App activated')
  if (BrowserWindow.getAllWindows().length === 0) {
    createControllerWindow()
  }
})