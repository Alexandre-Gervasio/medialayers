# 🎬 MediaLayers - Roadmap Completo: Fases 2-8

## 📊 Visão Geral do Projeto

```
FASE 1 ✅ CONCLUÍDA
├─ v1: Colunas + Layers
└─ v2: Grid + Stack Rendering + Blending Modes

FASE 2 ⏳ PRÓXIMA
├─ Monitor de Saída (Preview/Program)
├─ Sincronização em tempo real
└─ Multi-canvas rendering

FASE 3 ⏳ DEPOIS
├─ Interface dinâmica (dockable panels)
├─ Redimensionamento de painéis
└─ Persistência de layout

FASE 4 ⏳ DEPOIS
├─ Drag & Drop de arquivos
├─ Auto-detection de tipo de mídia
└─ Importação para grid

FASE 5 ⏳ DEPOIS
├─ Mesa de corte (Switcher)
├─ Área de Entradas (preview)
├─ Área de Saída (program)
└─ Transições rápidas entre clips

FASE 6 ⏳ DEPOIS
├─ Sistema modular de plugins
├─ Plugin de Texto (separado)
├─ Plugin de Bíblia
└─ Framework para novos plugins

FASE 7 ⏳ DEPOIS
├─ Vídeo remoto (WebRTC)
├─ URL/HTTP streams
├─ Browser source (OBS-style)
└─ Captura remota

FASE 8 ⏳ DEPOIS
├─ Controle via celular
├─ Interface web responsiva
├─ WebSocket server
└─ Sockets.io para sync real-time
```

---

# FASE 2: Monitor de Saída (Preview/Program)

## 🎯 Objetivo

Criar um sistema de **2 monitores de saída**:
1. **PREVIEW**: O que o operador está preparando
2. **PROGRAM**: O que o público está vendo (enviado para a tela/projetor)

Ambos sincronizados, mas independentes. Permite transições suaves entre clips.

## 📋 Requisitos

- [ ] Janela de saída física (já existe em `main.js`)
- [ ] 2 Canvas lado a lado (Preview + Program)
- [ ] Preview mostra célula selecionada em tempo real
- [ ] Program mostra célula "ao ar" (locked)
- [ ] Botão "ON AIR" para enviar Preview → Program
- [ ] Transições suaves (fade, cut, etc)
- [ ] Sincronização de layers/blending em tempo real

## 🏗️ Arquitetura de Dados

```javascript
// ESTADO DE SAÍDA
const outputState = {
  preview: {
    cellId: null,           // Célula sendo preparada
    row: null, col: null,
    layers: [],
    isLive: false
  },
  program: {
    cellId: null,           // Célula ao ar (público vê)
    row: null, col: null,
    layers: [],
    isLive: true
  },
  transition: {
    type: 'cut',            // 'cut', 'fade', 'dissolve', 'wipe'
    duration: 500,          // ms
    isTransitioning: false
  }
}

// COMUNICAÇÃO IPC (Electron)
// main.js ← → renderer (output window)
ipcMain.handle('grid:preview-changed', (e, { row, col, layers }) => {
  // Renderiza preview na saída
  outputWindow.webContents.send('preview:update', { row, col, layers })
})

ipcMain.on('grid:send-to-program', (e, { row, col, layers, transition }) => {
  // Envia preview para program
  outputWindow.webContents.send('program:go-live', { row, col, layers, transition })
})
```

## 🎬 Fluxo de Interação

```
1. Usuário seleciona célula [2, 3] no grid
   ↓
2. Preview renderiza [2, 3] em tempo real
   ↓
3. Usuário clica botão "ON AIR" (ou tecla/hotkey)
   ↓
4. Transição aplicada (fade 500ms)
   ↓
5. Program muda para [2, 3]
   ↓
6. Público vê novo conteúdo
```

## 💻 Componentes UI Necessários

```html
<!-- No painel central (próximo ao grid) -->
<div class="output-monitors">
  <div class="monitor preview">
    <div class="monitor-label">👁 PREVIEW</div>
    <canvas id="preview-output" width="320" height="180"></canvas>
    <div class="monitor-info">[2, 3] • 3 layers</div>
  </div>

  <button class="btn-go-live">→ ON AIR</button>

  <div class="monitor program">
    <div class="monitor-label">📺 PROGRAM</div>
    <canvas id="program-output" width="320" height="180"></canvas>
    <div class="monitor-info">🔴 LIVE: [2, 3]</div>
  </div>
</div>

<!-- Transição -->
<select id="transition-type">
  <option value="cut">Cut (instantâneo)</option>
  <option value="fade">Fade (0.5s)</option>
  <option value="dissolve">Dissolve (1s)</option>
</select>
```

## 📡 APIs Necessárias

```javascript
// Em app-grid-v2.js
function renderPreviewOutput(row, col) {
  // Renderiza célula na preview canvas
  // Mesma lógica de renderPreview(), mas em tela adicional
}

function sendToProgram(row, col, transition = 'cut') {
  // 1. Aplica transição
  // 2. Envia layers para janela de saída
  // 3. Atualiza programa output
  // 4. Notifica observers
  
  outputState.program = {
    cellId: grid[row][col].id,
    row, col,
    layers: grid[row][col].layers,
    isLive: true
  }
  
  // Envia para output window via IPC
  window.mediaLayers.sendToProgram({ row, col, layers, transition })
}

function getOutputState() {
  return {
    preview: outputState.preview,
    program: outputState.program,
    transition: outputState.transition
  }
}
```

## ⚙️ Modificações em main.js

```javascript
// Já existe, mas precisamos adicionar:
let outputWindow = null
let previewWindow = null  // Janela adicional para preview?

// Ou 2 canvas na mesma janela:
ipcMain.on('output:render-frame', (e, { frameData, isPreview }) => {
  if (isPreview) {
    // Renderiza no preview canvas
  } else {
    // Renderiza no program canvas
  }
})
```

## 🎨 CSS Necessário

```css
.output-monitors {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-dark);
  border-radius: 8px;
}

.monitor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.monitor canvas {
  width: 320px;
  height: 180px;
  border: 2px solid var(--border);
  border-radius: 6px;
  image-rendering: crisp-edges;
  aspect-ratio: 16/9;
}

.monitor-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--text-dim);
  font-weight: 600;
}

.monitor.program .monitor-label {
  color: #ff0000;  /* Vermelho = ao ar */
  animation: pulse 1s infinite;
}

#transition-type {
  padding: 8px 12px;
  background: var(--bg-item);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
}

.btn-go-live {
  padding: 12px 20px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-go-live:active {
  transform: scale(0.95);
}
```

## 🧪 Checklist de Implementação

- [ ] Adicionar 2 canvas ao lado do grid (preview + program)
- [ ] Criar `renderPreviewOutput()` em app-grid-v2.js
- [ ] Criar `sendToProgram()` com transições
- [ ] Adicionar selector de transição (cut, fade, dissolve)
- [ ] Sincronizar preview em tempo real ao selecionar célula
- [ ] Implementar button "ON AIR"
- [ ] Testar com janela de saída
- [ ] Adicionar hotkey (ex: SPACE para ON AIR)

## ⏱️ Estimativa: 3-4 horas

---

# FASE 3: Interface Dinâmica (Dockable Panels)

## 🎯 Objetivo

Permitir que o usuário **reorganize a interface** como profissionais (Ableton, Resolume, Nuke):
- Mover painéis
- Redimensionar
- Abrir/fechar abas
- Salvar/carregar layouts

## 📋 Requisitos

- [ ] Cada painel pode ser "dockado" em posições diferentes
- [ ] Redimensionamento com resize handles
- [ ] Tabs flutuantes/acopladas
- [ ] Save/Load de layouts (localStorage ou arquivo)
- [ ] Full-screen por painel
- [ ] Reset para layout padrão

## 🏗️ Arquitetura

### Usando Bibliotecas

**Option 1: Reescrever com dependência**
```bash
npm install goldenlayout  # Professional docking system
# Ou
npm install react-golden-layout
```

**Option 2: Implementação personalizada (mais controle)**
```javascript
// Sistema simples de resize/drag panels
class DockablePanel {
  constructor(name, parent, x, y, w, h) {
    this.name = name
    this.position = {x, y, w, h}
    this.isDocked = true
    this.isVisible = true
  }
  
  setPosition(x, y, w, h) { ... }
  toggleDock() { ... }
  toggleVisibility() { ... }
}

const layout = {
  panels: [
    new DockablePanel('editor', 'left', 0, 0, 280, 600),
    new DockablePanel('grid', 'center', 280, 0, 800, 600),
    new DockablePanel('properties', 'right', 1080, 0, 260, 600)
  ]
}
```

## 💾 Persistência

```javascript
// localStorage
function saveLayout() {
  const layoutData = {
    panels: layout.panels.map(p => ({
      name: p.name,
      position: p.position,
      isDocked: p.isDocked,
      isVisible: p.isVisible
    }))
  }
  localStorage.setItem('medialayers-layout', JSON.stringify(layoutData))
}

function loadLayout(layoutName = 'default') {
  const data = localStorage.getItem('medialayers-layout')
  if (data) {
    const layoutData = JSON.parse(data)
    layoutData.panels.forEach(p => {
      const panel = layout.panels.find(panel => panel.name === p.name)
      if (panel) {
        panel.setPosition(p.position.x, p.position.y, p.position.w, p.position.h)
        panel.isDocked = p.isDocked
        panel.isVisible = p.isVisible
      }
    })
  }
}
```

## 🧪 Checklist

- [ ] Implementar classe `DockablePanel`
- [ ] Adicionar event listeners para drag/resize
- [ ] Criar CSS para resize handles
- [ ] Implementar save/load layouts
- [ ] Criar menu de presets de layout
- [ ] Testar todas as combinações

## ⏱️ Estimativa: 4-5 horas

---

# FASE 4: Drag & Drop

## 🎯 Objetivo

Arrastar arquivos diretos na interface:
```
[Arrasta arquivo.mp4]
        ↓
[Solta na célula [2,3]]
        ↓
[Sistema detecta tipo + adiciona como layer]
```

## 📋 Requisitos

- [ ] Drop zones em pontos estratégicos
- [ ] Auto-detect de tipo (video, image, audio)
- [ ] Feedback visual (hover, drop-active)
- [ ] Multi-file support
- [ ] Undo/Redo para drop

## 🏗️ Implementação

```javascript
function setupDragDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    document.body.classList.add('drag-over')
  })
  
  document.addEventListener('dragleave', (e) => {
    if (e.target === document.body) {
      document.body.classList.remove('drag-over')
    }
  })
  
  document.addEventListener('drop', (e) => {
    e.preventDefault()
    document.body.classList.remove('drag-over')
    
    const files = e.dataTransfer.files
    const dropTarget = e.target.closest('[data-drop-zone]')
    
    if (dropTarget && files.length > 0) {
      handleDroppedFiles(files, dropTarget)
    }
  })
}

function handleDroppedFiles(files, dropTarget) {
  Array.from(files).forEach(file => {
    const type = getMediaType(file.type)  // 'video', 'image', 'audio'
    
    if (dropTarget.dataset.dropZone === 'grid') {
      const cellId = dropTarget.dataset.cellId
      // Encontra célula e adiciona layer
      addLayerToCell(cellId, type, file)
    }
    
    if (dropTarget.dataset.dropZone === 'library') {
      // Adiciona à biblioteca
      addToLibrary(type, file)
    }
  })
}

function getMediaType(mimeType) {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return null
}
```

## 🎨 CSS

```css
body.drag-over {
  background: rgba(233, 69, 96, 0.1);
  border: 2px dashed var(--accent);
}

[data-drop-zone] {
  position: relative;
  transition: opacity 0.2s;
}

[data-drop-zone].drag-target {
  opacity: 0.7;
  border: 2px dashed var(--accent);
}

.drag-preview {
  position: fixed;
  pointer-events: none;
  opacity: 0.7;
  background: var(--accent);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 10000;
}
```

## 🧪 Checklist

- [ ] Implementar drag listeners globais
- [ ] Adicionar data-drop-zone aos elementos
- [ ] Criar getMediaType() function
- [ ] Implementar feedback visual
- [ ] Testar com múltiplos arquivos
- [ ] Adicionar drag preview customizado

## ⏱️ Estimativa: 2-3 horas

---

# FASE 5: Mesa de Corte (Switcher)

## 🎯 Objetivo

Criar estrutura de **ENTRADAS vs SAÍDA** como um video switcher profissional:

```
┌─ ENTRADAS ──────────────────────────────────┐
│ [Clip A] [Clip B] [Câmera] [Arquivo.mp4]  │
│  (preview)                                  │
└─────────────────────────────────────────────┘
         ↓ (clique para enviar)
┌─ SAÍDA (PROGRAM) ────────────────────────────┐
│  Muda de Clip A → Clip B com transição     │
│  (Público vê isto)                         │
└─────────────────────────────────────────────┘
```

## 📋 Requisitos

- [ ] 2 seções: ENTRADAS + SAÍDA
- [ ] ENTRADAS mostra todos os clientes/câmeras/arquivos
- [ ] SAÍDA mostra o que está ao ar
- [ ] Clique em entrada = envia para saída
- [ ] Histórico de mudanças
- [ ] Auto-play timeline (opcional)

## 🏗️ Estado

```javascript
const switcherState = {
  inputs: [
    { id, name, type, source, isActive: false },  // Câmera, arquivo, etc
    { id, name, type, source, isActive: false }
  ],
  outputs: [
    { id, name, currentInputId, isLive: true }
  ],
  history: [
    { timestamp, from, to, transition }
  ]
}
```

## 💻 UI

```html
<div class="switcher-panel">
  <div class="inputs-section">
    <h3>📥 ENTRADAS</h3>
    <div class="inputs-grid">
      <div class="input-slot" data-input-id="1">
        <canvas></canvas>
        <label>Câmera 1</label>
        <button onclick="selectInput(1)">SELECT</button>
      </div>
      <!-- mais inputs -->
    </div>
  </div>

  <div class="transition-controls">
    <select id="transition-type">
      <option>Cut</option>
      <option>Fade</option>
      <option>Dissolve</option>
    </select>
    <input type="range" id="transition-time" min="0" max="2000">
  </div>

  <div class="outputs-section">
    <h3>📤 SAÍDA (PROGRAM)</h3>
    <div class="output-display">
      <canvas id="program-canvas"></canvas>
      <div class="live-indicator">🔴 AO AR</div>
    </div>
  </div>

  <div class="history">
    <h4>Histórico</h4>
    <ul id="switch-history">
      <!-- timestamp, inputs mudaram para outputs -->
    </ul>
  </div>
</div>
```

## 🧪 Checklist

- [ ] Criar estrutura HTML switcher
- [ ] Implementar inputs pool com preview
- [ ] Implementar outputs display
- [ ] Criar selectInput() function
- [ ] Adicionar histórico de transições
- [ ] Testar fluxo de switching
- [ ] Adicionar hotkeys para inputs (1,2,3...)

## ⏱️ Estimativa: 4-5 horas

---

# FASE 6: Sistema Modular de Plugins

## 🎯 Objetivo

Tornar Texto e Bíblia como **plugins independentes** que possam ser:
- Ativados/desativados
- Carregados dinamicamente
- Reutilizados em qualquer célula

## 🏗️ Arquitetura

### Base Plugin System

```javascript
// plugins/base-plugin.js
class MediaLayersPlugin {
  constructor(name, version) {
    this.name = name
    this.version = version
    this.isEnabled = false
  }
  
  onLoad() { /* chamado ao inicializar */ }
  onUnload() { /* chamado ao desativar */ }
  
  addUI() { /* adiciona botões à toolbar */ }
  removeUI() { /* remove elementos */ }
  
  createLayer(config) { /* cria uma layer do tipo deste plugin */ }
  renderLayer(canvas, layer) { /* renderiza no canvas */ }
}

// plugins/manage.js
class PluginManager {
  constructor() {
    this.plugins = new Map()
  }
  
  register(plugin) {
    this.plugins.set(plugin.name, plugin)
  }
  
  enable(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      plugin.isEnabled = true
      plugin.onLoad()
      plugin.addUI()
    }
  }
  
  disable(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      plugin.isEnabled = false
      plugin.removeUI()
      plugin.onUnload()
    }
  }
  
  createLayer(pluginName, config) {
    const plugin = this.plugins.get(pluginName)
    if (plugin && plugin.isEnabled) {
      return plugin.createLayer(config)
    }
  }
}
```

### Plugin de Texto

```javascript
// plugins/text-plugin.js
class TextPlugin extends MediaLayersPlugin {
  constructor() {
    super('text', '1.0.0')
  }
  
  onLoad() {
    console.log('✓ Text Plugin carregado')
  }
  
  addUI() {
    const btn = document.createElement('button')
    btn.id = 'btn-add-text-layer'
    btn.textContent = '📝'
    btn.addEventListener('click', () => this.createTextLayer())
    document.querySelector('.media-toolbar').appendChild(btn)
  }
  
  createLayer(config) {
    return {
      id: nextId++,
      type: 'text-plugin',
      plugin: 'text',
      name: config.name || 'Texto',
      text: config.text || 'Digite aqui',
      fontSize: config.fontSize || 48,
      fontColor: config.fontColor || '#ffffff',
      fontBg: config.fontBg || 'rgba(0,0,0,0.5)',
      opacity: 1,
      visible: true,
      blendMode: 'normal'
    }
  }
  
  renderLayer(ctx, layer, width, height) {
    // Renderiza texto no canvas
    ctx.fillStyle = layer.fontBg
    ctx.fillRect(10, height - 100, width - 20, 80)
    
    ctx.fillStyle = layer.fontColor
    ctx.font = `${layer.fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(layer.text, width / 2, height - 30)
  }
}
```

### Plugin de Bíblia

```javascript
// plugins/biblia-plugin.js
class BibliaPlugin extends MediaLayersPlugin {
  constructor(bibleData) {
    super('biblia', '1.0.0')
    this.bibleData = bibleData  // DB de versículos
  }
  
  onLoad() {
    console.log('✓ Bíblia Plugin carregado')
  }
  
  addUI() {
    const btn = document.createElement('button')
    btn.textContent = '✝'
    btn.addEventListener('click', () => this.openBibliaPanel())
    document.querySelector('.media-toolbar').appendChild(btn)
  }
  
  openBibliaPanel() {
    // Abre modal para buscar versículos
    // Permite selecionar e adicionar à célula
  }
  
  createLayer(config) {
    return {
      id: nextId++,
      type: 'text-biblia',
      plugin: 'biblia',
      name: config.reference,  // 'João 3:16'
      text: config.text,       // Versículo completo
      reference: config.reference,
      fontSize: 40,
      fontColor: '#ffff00',
      fontBg: 'rgba(0,0,0,0.7)',
      opacity: 1,
      visible: true,
      blendMode: 'screen'
    }
  }
  
  renderLayer(ctx, layer, width, height) {
    ctx.fillStyle = layer.fontBg
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = layer.fontColor
    ctx.font = `${layer.fontSize}px Arial`
    ctx.textAlign = 'center'
    
    // Renderiza referência + versículo
    ctx.fillText(layer.reference, width / 2, 50)
    ctx.font = `${layer.fontSize - 8}px Arial`
    ctx.fillText(layer.text, width / 2, height / 2)
  }
}
```

### Inicializar Plugins

```javascript
// app-grid-v2.js
const pluginManager = new PluginManager()

// Registrar plugins
pluginManager.register(new TextPlugin())
pluginManager.register(new BibliaPlugin(bibliaDB))

// Ativar plugins padrão
pluginManager.enable('text')
pluginManager.enable('biblia')

// Na renderização:
function renderPreview(row, col) {
  cell.layers.forEach(layer => {
    if (layer.type.includes('plugin')) {
      const plugin = pluginManager.plugins.get(layer.plugin)
      if (plugin) {
        plugin.renderLayer(previewCtx, layer, width, height)
      }
    }
  })
}
```

## 🧪 Checklist

- [ ] Criar classe `MediaLayersPlugin` base
- [ ] Criar classe `PluginManager`
- [ ] Refatorar Plugin de Texto
- [ ] Refatorar Plugin de Bíblia
- [ ] Implementar load/unload dinâmico
- [ ] Testar ativação/desativação
- [ ] Criar documentação para novos plugins

## ⏱️ Estimativa: 3-4 horas

---

# FASE 7: Vídeo Remoto (WebRTC/HTTP)

## 🎯 Objetivo

Permitir receber vídeo de fontes remotas:
```
[URL/Stream HTTP]  → [Elemento <video>] → [Canvas]
[WebRTC peer]      → [MediaStream]       → [Canvas]
[Página web]       → [<iframe>]          → [Screenshot] → [Canvas]
```

## 📋 Requisitos

- [ ] Input de URL
- [ ] Suporte a HTTP/HTTPS streams
- [ ] WebRTC peer connections
- [ ] Browser source (iframe screenshot)
- [ ] CORS handling
- [ ] Error handling e fallbacks

## 🏗️ Implementação

### Opção 1: URL HTTP Stream

```javascript
function addRemoteVideoStream(url) {
  const layer = createLayer('remote-video', url, url)
  layer.src = url
  layer.renderer = 'http-stream'
  
  const video = document.createElement('video')
  video.src = url
  video.crossOrigin = 'anonymous'
  video.autoplay = true
  video.loop = true
  video.onloadedmetadata = () => {
    layer.videoElement = video
    console.log(`✓ Stream loaded: ${url}`)
  }
  video.onerror = () => {
    console.error(`✗ Stream error: ${url}`)
  }
  
  return layer
}
```

### Opção 2: WebRTC (Peer-to-Peer)

```javascript
class WebRTCInput {
  constructor() {
    this.peerConnection = null
    this.mediaStream = null
  }
  
  async connect(offerId) {
    this.peerConnection = new RTCPeerConnection()
    
    // Receber tracks remotos
    this.peerConnection.ontrack = (event) => {
      this.mediaStream = event.streams[0]
      console.log('✓ Remote stream received')
    }
    
    // Processar offer
    const offer = new RTCSessionDescription(JSON.parse(offerId))
    await this.peerConnection.setRemoteDescription(offer)
    
    // Enviar answer
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    
    return JSON.stringify(this.peerConnection.localDescription)
  }
  
  getMediaStream() {
    return this.mediaStream
  }
}

function addWebRTCInput(offerId) {
  const webrtc = new WebRTCInput()
  webrtc.connect(offerId).then(answer => {
    // Envia answer para peer
    window.mediaLayers.sendWebRTCAnswer(answer)
  })
  
  const layer = createLayer('webrtc-input', 'WebRTC Remote', null)
  layer.mediaStream = webrtc.getMediaStream()
  layer.renderer = 'webrtc'
  
  return layer
}
```

### Opção 3: Browser Source (iframe screenshot)

```javascript
function addBrowserSource(url) {
  const layer = createLayer('browser-source', url, null)
  
  // Cria iframe oculto
  const iframe = document.createElement('iframe')
  iframe.src = url
  iframe.style.display = 'none'
  iframe.style.width = '1920px'
  iframe.style.height = '1080px'
  iframe.onload = () => {
    layer.iframe = iframe
    console.log(`✓ Browser source loaded: ${url}`)
  }
  
  document.body.appendChild(iframe)
  layer.renderer = 'browser-source'
  
  return layer
}

// Na renderização:
function renderBrowserSourceLayer(ctx, layer, width, height) {
  try {
    ctx.drawImage(layer.iframe, 0, 0, width, height)
  } catch (e) {
    // CORS error - fallback
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#fff'
    ctx.fillText('Browser Source (CORS)', width / 2, height / 2)
  }
}
```

## 🧪 Checklist

- [ ] Adicionar input field para URL
- [ ] Implementar addRemoteVideoStream()
- [ ] Implementar WebRTCInput class
- [ ] Implementar addBrowserSource()
- [ ] Testar com URL pública
- [ ] Testar com WebRTC peer
- [ ] Testar CORS handling
- [ ] Adicionar botão "Add Remote" à toolbar

## ⏱️ Estimativa: 4-5 horas

---

# FASE 8: Controle Remoto via Celular

## 🎯 Objetivo

Criar interface web para controlar o MediaLayers via celular:
```
[Celular: Interface web] ↔ [WebSocket] ↔ [MediaLayers: main.js]
```

## 📋 Requisitos

- [ ] Server WebSocket (Socket.io)
- [ ] Interface web responsiva
- [ ] Sincronização em tempo real
- [ ] Controle de:
  - [ ] Seleção de célula/clip
  - [ ] ON AIR (enviar para program)
  - [ ] Controle de layers (show/hide, opacidade)
  - [ ] Busca de versículos (Bíblia)
  - [ ] Busca de músicas (Letras)
- [ ] Modo fullscreen
- [ ] Modo landscape/portrait

## 🏗️ Arquitetura

### Backend (Node.js + Socket.io)

```javascript
// server/remote-control-server.js
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: { origin: '*' }
})

// Servir interface web
app.use(express.static('public/remote-control'))

// Gerenciar conexões
const clients = new Map()

io.on('connection', (socket) => {
  console.log(`✓ Client conectado: ${socket.id}`)
  
  // Receber comando de seleção
  socket.on('grid:select-cell', ({ row, col }) => {
    // Envia para main window via IPC
    mainWindow.webContents.send('remote:select-cell', { row, col })
  })
  
  // Receber comando ON AIR
  socket.on('grid:go-live', ({ row, col, transition }) => {
    mainWindow.webContents.send('remote:go-live', { row, col, transition })
  })
  
  // Sincronizar estado
  socket.on('request:state', () => {
    mainWindow.webContents.send('request:get-state')
  })
  
  // Desconectar
  socket.on('disconnect', () => {
    console.log(`✗ Client desconectado: ${socket.id}`)
  })
})

// Receber estado do main window
ipcMain.on('remote:broadcast-state', (e, state) => {
  io.emit('state:update', state)
})

server.listen(3000, () => {
  console.log('✓ Remote Control Server rodando em http://localhost:3000')
})
```

### Frontend (Web)

```html
<!-- public/remote-control/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>MediaLayers Remote</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>🎬 MediaLayers Remote</h1>
    <div class="status" id="status">Conectando...</div>
  </header>

  <main>
    <!-- Grid remoto mostrando células -->
    <div id="remote-grid" class="remote-grid">
      <!-- Cells renderizadas aqui -->
    </div>

    <!-- Controles -->
    <div class="controls">
      <button id="btn-remote-go-live" class="btn btn-primary">→ ON AIR</button>
      <select id="transition-select">
        <option value="cut">Cut</option>
        <option value="fade">Fade</option>
      </select>
    </div>

    <!-- Info de célula selecionada -->
    <div id="cell-info" class="info">
      Selecione uma célula
    </div>
  </main>

  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

```javascript
// public/remote-control/app.js
const socket = io()
let remoteState = null
let selectedCell = null

socket.on('connect', () => {
  document.getElementById('status').textContent = '✓ Conectado'
  document.getElementById('status').style.color = '#4ade80'
})

socket.on('disconnect', () => {
  document.getElementById('status').textContent = '✗ Desconectado'
  document.getElementById('status').style.color = '#ff0000'
})

socket.on('state:update', (state) => {
  remoteState = state
  renderRemoteGrid()
  updateCellInfo()
})

function renderRemoteGrid() {
  if (!remoteState || !remoteState.grid) return
  
  const gridEl = document.getElementById('remote-grid')
  gridEl.innerHTML = ''
  gridEl.style.gridTemplateColumns = `repeat(${remoteState.gridCols}, 1fr)`
  
  remoteState.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      const cellEl = document.createElement('div')
      cellEl.className = `remote-cell`
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        cellEl.classList.add('selected')
      }
      
      cellEl.textContent = cell.layers.length > 0 ? `${cell.layers.length} 🎬` : '📭'
      cellEl.onclick = () => selectRemoteCell(r, c)
      
      gridEl.appendChild(cellEl)
    })
  })
}

function selectRemoteCell(row, col) {
  selectedCell = { row, col }
  socket.emit('grid:select-cell', { row, col })
  renderRemoteGrid()
}

function goLive() {
  if (!selectedCell) return
  const transition = document.getElementById('transition-select').value
  socket.emit('grid:go-live', {
    row: selectedCell.row,
    col: selectedCell.col,
    transition
  })
}

// Solicitar atualização inicial
socket.emit('request:state')

// Atualizar a cada 500ms
setInterval(() => {
  socket.emit('request:state')
}, 500)

// Botão ON AIR
document.getElementById('btn-remote-go-live').addEventListener('click', goLive)
```

### CSS

```css
/* public/remote-control/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%;
  height: 100%;
  font-family: Arial, sans-serif;
  background: #0d0d1a;
  color: #e0e0e0;
}

header {
  background: #16213e;
  padding: 16px;
  text-align: center;
  border-bottom: 2px solid #0f3460;
}

h1 {
  font-size: 1.2rem;
  margin-bottom: 8px;
}

.status {
  font-size: 0.8rem;
  color: #888;
}

main {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100% - 80px);
  overflow-y: auto;
}

.remote-grid {
  display: grid;
  grid-auto-rows: 80px;
  gap: 4px;
  flex: 1;
  overflow: auto;
}

.remote-cell {
  background: #1a2a4a;
  border: 2px solid #1f3560;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 24px;
  transition: all 0.2s;
  user-select: none;
}

.remote-cell:active {
  transform: scale(0.95);
}

.remote-cell.selected {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
  border-width: 3px;
}

.controls {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #16213e;
  border-radius: 6px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  background: #1a2a4a;
  color: #e0e0e0;
}

.btn-primary {
  background: #e94560;
  color: #fff;
  flex: 1;
}

#transition-select {
  padding: 10px;
  background: #1a2a4a;
  border: 1px solid #1f3560;
  color: #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
}

.info {
  padding: 12px;
  background: #1a2a4a;
  border: 1px solid #1f3560;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  h1 { font-size: 1rem; }
  .remote-grid { grid-auto-rows: 60px; }
  .btn { padding: 8px 12px; }
}

@media (max-width: 480px) {
  header { padding: 12px; }
  main { padding: 8px; gap: 8px; }
  .remote-grid { gap: 2px; grid-auto-rows: 50px; }
}
```

## 🧪 Checklist

- [ ] Criar express server com Socket.io
- [ ] Implementar remote-control-server.js
- [ ] Criar interface web HTML/CSS
- [ ] Implementar Socket.io client
- [ ] Renderizar grid remoto
- [ ] Sincronizar seleção de célula
- [ ] Implementar botão ON AIR remoto
- [ ] Testar em celular/tablet
- [ ] Adicionar orientação landscape/portrait
- [ ] Testar com múltiplos clientes

## ⏱️ Estimativa: 5-6 horas

---

# 📊 Resumo Executivo: Fases 2-8

## ⏱️ Timeline Estimado

```
Fase 2 (Preview/Program):       3-4 horas
Fase 3 (Dockable Panels):       4-5 horas
Fase 4 (Drag & Drop):           2-3 horas
Fase 5 (Mesa de Corte):         4-5 horas
Fase 6 (Plugins Modulares):     3-4 horas
Fase 7 (Vídeo Remoto):          4-5 horas
Fase 8 (Controle Celular):      5-6 horas
─────────────────────────────────────────
TOTAL:                          26-32 horas
```

## 🔄 Dependências Entre Fases

```
Fase 1 (Grid) ✅
    ↓
Fase 2 (Preview) ← depende de Grid
    ↓
Fase 5 (Switcher) ← depende de Preview
    ↓
Fase 8 (Remote) ← depende de Switcher

Fase 3 (Dockable) ← independente, mas melhora UX
Fase 4 (Drag Drop) ← independente, mas melhora UX
Fase 6 (Plugins) ← independente, refactoring
Fase 7 (WebRTC) ← depende de Preview
```

## 🎯 Ordem Recomendada

1. **Fase 2**: Preview/Program (base para resto)
2. **Fase 4**: Drag & Drop (melhora workflow)
3. **Fase 5**: Switcher (visual)
4. **Fase 3**: Dockable Panels (refine UX)
5. **Fase 6**: Plugins (refactoring)
6. **Fase 7**: WebRTC (avançado)
7. **Fase 8**: Remote (final)

## 🏆 Resultado Final

Ao final das 8 fases, você terá:

✅ Grid profissional 2D com blending modes  
✅ Monitor de saída real-time (Preview + Program)  
✅ Interface customizável (dockable panels)  
✅ Drag & Drop intuitivo  
✅ Mesa de corte para switching rápido  
✅ Sistema de plugins modular  
✅ Suporte a vídeo remoto (HTTP, WebRTC, Browser)  
✅ Controle remoto via celular (Socket.io web)  

**Resultado:** Um software de apresentação/broadcasting **PROFISSIONAL** que compete com Resolume Arena, OBS, HolyLyrics!

---

## 📚 Próximos Passos

1. Leia este documento inteiro
2. Escolha se quer começar pela **Fase 2** (Preview)
3. Eu crio a arquitetura + código
4. Você testa e dá feedback
5. Passamos para próxima fase

**Quer começar pela Fase 2 agora?** ✅

