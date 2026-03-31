// ════════════════════════════════════════════════════════════════
// app-grid-v2.js
// MEDIALAYERS v2 - Grid de Clips com Stack-Based Rendering + Blending
// ════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// ARQUITETURA DE DADOS
// ─────────────────────────────────────────────
/*
GRID (2D Matrix)
├── [0][0] → Clip Cell
│   ├── layers[] → Stack de layers
│   │   ├── Layer { id, type, src, opacity, blend, visible, ... }
│   │   ├── Layer { ... }
│   │   └── Layer { ... }
├── [0][1] → Clip Cell
│   └── layers[]
└── [3][5] → Clip Cell
    └── layers[]

BLENDING MODES SUPORTADOS:
normal, multiply, screen, overlay, add, subtract, lighten, darken, etc
*/

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
let grid = []                    // Matriz 2D de células
let gridRows = 1                 // Linhas do grid (inicia com 1)
let gridCols = 1                 // Colunas do grid (inicia com 1)
let selectedCell = null          // {row, col} célula selecionada
let selectedLayerId = null       // ID da layer selecionada
let nextId = 1

// Streams ativos (câmeras)
const activeStreams = {}
const streamChannel = new BroadcastChannel('medialayers-streams')

// Canvas preview (consolidado)
let previewCanvas = null
let previewCtx = null

// ═════════════════════════════════════════════════════════════
// FASE 2: MONITORES DE SAÍDA (Preview + Program)
// ═════════════════════════════════════════════════════════════
let monitorPreviewCanvas = null
let monitorPreviewCtx = null
let monitorProgramCanvas = null
let monitorProgramCtx = null

// ═════════════════════════════════════════════════════════════
// FASE 5: MESA DE CORTE / SWITCHER
// ═════════════════════════════════════════════════════════════
let inputs = [] // Array de entradas (câmeras, clips, etc.)
let selectedInputId = null // ID da entrada selecionada
let nextInputId = 1

// Classe para representar uma entrada
class InputSource {
  constructor(type, name, src = null) {
    this.id = nextInputId++
    this.type = type // 'camera', 'clip', 'ndi', etc.
    this.name = name
    this.src = src
    this.thumbnail = null // Canvas ou imagem para preview
    this.isLive = false
  }
}

// Estado de saída
const outputState = {
  preview: {
    row: null,
    col: null,
    cellId: null,
    layers: [],
  },
  program: {
    row: null,
    col: null,
    cellId: null,
    layers: [],
  },
  transition: {
    type: 'cut',        // 'cut', 'fade', 'dissolve'
    duration: 500,      // ms
    isTransitioning: false,
    startTime: null,
  }
}

// ─────────────────────────────────────────────
// BLENDING MODES DISPONÍVEIS
// ─────────────────────────────────────────────
const BLEND_MODES = {
  'normal': 'multiply',         // Padrão
  'multiply': 'multiply',       // Escurece
  'screen': 'screen',           // Clareia
  'overlay': 'overlay',         // Contraste
  'add': 'lighter',             // Aditivo (brilho)
  'subtract': 'darken',         // Reduz
  'lighten': 'lighten',         // Apenas luz
  'darken': 'darken',           // Apenas sombra
  'color-dodge': 'lighten',     // Dodge
  'color-burn': 'darken',       // Burn
}

// ─────────────────────────────────────────────
// CRIAR CÉLULA VAZIA
// ─────────────────────────────────────────────
function createCell() {
  return {
    layers: [],    // Array de layers
    isPlaying: false,
  }
}

// ─────────────────────────────────────────────
// CRIAR LAYER
// ─────────────────────────────────────────────
function createLayer(type, name, src = null, pluginName = null) {
  return {
    id: nextId++,
    type,             // 'video' | 'image' | 'text' | 'audio' | 'camera' | 'plugin'
    pluginName,      // para plugins customizados
    name,
    src,              // blob URL
    opacity: 1,
    visible: true,
    blendMode: 'normal',
    // Props extras por tipo
    text: type === 'text' ? 'Texto' : null,
    fontSize: 24,
    fontColor: '#ffffff',
    fontBg: 'rgba(0,0,0,0.5)',
    loop: type === 'video',
    volume: 1,
  }
}

// ─────────────────────────────────────────────
// ÍCONE POR TIPO
// ─────────────────────────────────────────────
function iconFor(type) {
  return {
    video: '🎥',
    image: '🖼',
    audio: '🔊',
    text: '📝',
    camera: '📷',
    ndi: '📡',
  }[type] || '▪'
}

// Obtém layer por ID, mantendo célula de origem
function getLayerById(layerId) {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const layer = grid[r][c].layers.find(l => l.id === layerId)
      if (layer) {
        return { layer, row: r, col: c }
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────
// INICIALIZAR GRID
// ─────────────────────────────────────────────
function initializeGrid(rows, cols) {
  grid = []
  gridRows = rows
  gridCols = cols

  for (let r = 0; r < rows; r++) {
    grid[r] = []
    for (let c = 0; c < cols; c++) {
      grid[r][c] = createCell()
    }
  }

  console.log(`✓ Grid inicializado: ${rows}×${cols}`)
}

// ─────────────────────────────────────────────
// RENDERIZAR GRID (DOM - clips visualization)
// ─────────────────────────────────────────────
function renderGrid() {
  const gridEl = document.getElementById('clips-grid')
  if (!gridEl) return

  // Define o template do grid (CSS Grid)
  gridEl.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`

  gridEl.innerHTML = ''

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cell = grid[r][c]
      const cellEl = document.createElement('div')
      cellEl.className = `clip-cell`
      cellEl.dataset.row = r
      cellEl.dataset.col = c

      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        cellEl.classList.add('selected')
      }

      if (cell.isPlaying) {
        cellEl.classList.add('playing')
      }

      // Mostra quantas layers tem
      const layerCount = cell.layers.length
      cellEl.innerHTML = `
        <div class="clip-label">
          ${layerCount > 0 ? `${layerCount} 🎬` : '📭'}
        </div>
        <div class="clip-label" style="font-size: 0.65rem; color: var(--text-dim);">
          [${r}, ${c}]
        </div>
      `

      cellEl.addEventListener('click', () => selectCell(r, c))
      cellEl.addEventListener('dblclick', () => triggerCell(r, c))

      gridEl.appendChild(cellEl)
    }
  }

  // Re-aplicar listeners após renderizar o grid dinâmico
  setupCellDragDropListeners()
}

// ─────────────────────────────────────────────
// SELECIONAR CÉLULA
// ─────────────────────────────────────────────
function selectCell(row, col) {
  selectedCell = { row, col }
  selectedLayerId = null
  renderGrid()
  renderLayersPanel()
  renderProperties()
  updateCellInfo()
  
  // FASE 2: Renderiza monitor preview quando célula é selecionada
  outputState.preview.row = row
  outputState.preview.col = col
  renderMonitorPreview(row, col)
}

// ─────────────────────────────────────────────
// TRIGGER CÉLULA (disparar/play)
// ─────────────────────────────────────────────
function triggerCell(row, col) {
  const cell = grid[row][col]
  cell.isPlaying = true
  renderGrid()
  renderPreview(row, col)

  // Timeout para parar a animação
  setTimeout(() => {
    cell.isPlaying = false
    renderGrid()
  }, 2000)
}

// ─────────────────────────────────────────────
// RENDERIZAR PAINEL DE LAYERS
// ─────────────────────────────────────────────
function renderLayersPanel() {
  const panel = document.getElementById('layers-panel')
  if (!panel) return

  if (!selectedCell) {
    panel.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Selecione uma célula</div>'
    return
  }

  const cell = grid[selectedCell.row][selectedCell.col]

  panel.innerHTML = ''

  if (cell.layers.length === 0) {
    panel.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Sem camadas</div>'
  } else {
    // Renderiza de trás para frente (última camada no topo)
    ;[...cell.layers].reverse().forEach(layer => {
      const li = document.createElement('div')
      li.className = `layer-item ${layer.id === selectedLayerId ? 'selected' : ''} ${!layer.visible ? 'muted' : ''}`
      li.dataset.layerId = layer.id

      li.innerHTML = `
        <span class="layer-icon">${iconFor(layer.type)}</span>
        <span class="layer-name" title="${layer.name}">${layer.name}</span>
        <div class="layer-actions">
          <button class="layer-btn" data-action="toggle" title="Mostrar/Ocultar">
            ${layer.visible ? '👁' : '🚫'}
          </button>
          <button class="layer-btn" data-action="delete" title="Deletar">
            🗑
          </button>
        </div>
      `

      li.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          selectLayer(layer.id)
        }
      })

      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="delete"]')) {
          deleteLayer(layer.id)
        }
        if (e.target.closest('[data-action="toggle"]')) {
          toggleLayerVisibility(layer.id)
        }
      })

      panel.appendChild(li)
    })
  }
}

// ─────────────────────────────────────────────
// SELECIONAR LAYER
// ─────────────────────────────────────────────
function selectLayer(layerId) {
  selectedLayerId = layerId
  renderLayersPanel()
  renderProperties()
}

// ─────────────────────────────────────────────
// ADICIONAR LAYER À CÉLULA ATIVA
// ─────────────────────────────────────────────
function addMediaLayer(type, fileInputId) {
  if (!selectedCell) {
    alert('Selecione uma célula primeiro!')
    return
  }

  const cell = grid[selectedCell.row][selectedCell.col]

  // Suporte a types de plugin customizadas
  const customLayerType = window.MediaLayersPlugins?.manager?.getCustomLayerTypes()?.find(t => t.name === type)
  if (customLayerType) {
    const layer = createLayer('plugin', `${customLayerType.label}`, null, customLayerType.pluginName)
    layer.pluginType = customLayerType.name
    cell.layers.push(layer)
    selectLayer(layer.id)
    renderLayersPanel()
    renderPreview(selectedCell.row, selectedCell.col)
    return
  }

  const input = document.getElementById(fileInputId)
  input.value = ''

  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const src = URL.createObjectURL(file)
    const layer = createLayer(type, file.name, src)
    cell.layers.push(layer)

    selectLayer(layer.id)
    renderLayersPanel()
    renderPreview(selectedCell.row, selectedCell.col)
  }

  input.click()
}

// ─────────────────────────────────────────────
// ADICIONAR LAYER DE TEXTO
// ─────────────────────────────────────────────
function addTextLayer() {
  if (!selectedCell) {
    alert('Selecione uma célula primeiro!')
    return
  }

  const cell = grid[selectedCell.row][selectedCell.col]
  const layer = createLayer('text', `Texto ${nextId}`)
  cell.layers.push(layer)

  selectLayer(layer.id)
  renderLayersPanel()
  renderPreview(selectedCell.row, selectedCell.col)
}

function addPluginLayer() {
  if (!selectedCell) {
    alert('Selecione uma célula primeiro!')
    return
  }

  const pluginTypes = window.MediaLayersPlugins?.manager?.getCustomLayerTypes() || []
  if (pluginTypes.length === 0) {
    alert('Nenhum plugin habilitado com tipos de layer disponíveis.')
    return
  }

  const names = pluginTypes.map((t, idx) => `${idx + 1}) ${t.label}`).join('\n')
  const selection = prompt(`Escolha um plugin para adicionar:\n${names}`)
  if (!selection) return

  const choice = pluginTypes[parseInt(selection, 10) - 1]
  if (!choice) {
    alert('Seleção inválida')
    return
  }

  const cell = grid[selectedCell.row][selectedCell.col]
  const layer = createLayer('plugin', choice.label, null, choice.name)
  layer.pluginType = choice.name
  cell.layers.push(layer)

  selectLayer(layer.id)
  renderLayersPanel()
  renderPreview(selectedCell.row, selectedCell.col)
}

async function addRemoteLayer() {
  if (!selectedCell) {
    alert('Selecione uma célula primeiro!')
    return
  }

  const mode = prompt('Tipo de stream remoto:\n1) HTTP/HTTPS URL\n2) WebRTC (Offer/Answer)\nDigite 1 ou 2', '1')
  if (!mode) return

  const cell = grid[selectedCell.row][selectedCell.col]
  let layer = null

  if (mode.trim() === '1') {
    const streamUrl = prompt('Cole a URL do stream remoto (http:// ou https://):')
    if (!streamUrl) return

    layer = createLayer('remote', `Remoto: ${streamUrl}`, streamUrl)
    layer.remoteType = 'http'
    layer.remoteUrl = streamUrl
    layer.visible = true
    cell.layers.push(layer)

  } else if (mode.trim() === '2') {
    layer = createLayer('remote', 'WebRTC Remote', null)
    layer.remoteType = 'webrtc'
    layer.visible = true
    cell.layers.push(layer)

    await setupWebRTCReceiver(layer)
  } else {
    alert('Modo inválido')
    return
  }

  selectLayer(layer.id)
  renderLayersPanel()
  renderPreview(selectedCell.row, selectedCell.col)
}


// ─────────────────────────────────────────────
// DELETE LAYER
// ─────────────────────────────────────────────
function deleteLayer(layerId) {
  if (!selectedCell) return

  const cell = grid[selectedCell.row][selectedCell.col]

  // Stop stream se for câmera
  if (activeStreams[layerId]) {
    activeStreams[layerId].getTracks().forEach(t => t.stop())
    delete activeStreams[layerId]
  }

  cell.layers = cell.layers.filter(l => l.id !== layerId)

  if (selectedLayerId === layerId) {
    selectedLayerId = null
  }

  renderLayersPanel()
  renderProperties()
  renderPreview(selectedCell.row, selectedCell.col)
}

// ─────────────────────────────────────────────
// TOGGLE LAYER VISIBILITY
// ─────────────────────────────────────────────
function toggleLayerVisibility(layerId) {
  if (!selectedCell) return

  const cell = grid[selectedCell.row][selectedCell.col]
  const layer = cell.layers.find(l => l.id === layerId)

  if (layer) {
    layer.visible = !layer.visible
    renderLayersPanel()
    renderPreview(selectedCell.row, selectedCell.col)
  }
}

// ─────────────────────────────────────────────
// UPDATE CELL INFO
// ─────────────────────────────────────────────
function updateCellInfo() {
  const info = document.getElementById('cell-coords')
  if (!info) return

  if (!selectedCell) {
    info.textContent = 'Nenhuma célula selecionada'
  } else {
    const cell = grid[selectedCell.row][selectedCell.col]
    info.textContent = `Célula [${selectedCell.row}, ${selectedCell.col}] • ${cell.layers.length} camadas`
  }
}

// ─────────────────────────────────────────────
// RENDER PREVIEW (Canvas - Stack-Based Rendering)
// ─────────────────────────────────────────────
function renderPreview(row, col) {
  if (!previewCanvas || !previewCtx) return

  const cell = grid[row][col]
  const w = previewCanvas.width
  const h = previewCanvas.height

  // Limpa canvas
  previewCtx.fillStyle = '#000000'
  previewCtx.fillRect(0, 0, w, h)

  if (cell.layers.length === 0) {
    previewCtx.fillStyle = '#666666'
    previewCtx.font = '24px Arial'
    previewCtx.textAlign = 'center'
    previewCtx.fillText('Nenhuma camada', w / 2, h / 2)
    return
  }

  // Stack-based rendering: renderiza layers de trás para frente
  cell.layers.forEach((layer) => {
    if (!layer.visible) return

    // Aplica blending mode
    previewCtx.globalCompositeOperation = BLEND_MODES[layer.blendMode] || 'source-over'
    previewCtx.globalAlpha = layer.opacity

    // Renderiza cada tipo de layer
    if (layer.type === 'video' && layer.src) {
      // Placeholder para vídeo
      previewCtx.fillStyle = 'rgba(100, 100, 100, 0.5)'
      previewCtx.fillRect(10, 10, w - 20, h - 20)
      previewCtx.fillStyle = '#ffffff'
      previewCtx.font = '16px Arial'
      previewCtx.fillText('🎥 ' + layer.name, w / 2, h / 2)
    }

    if (layer.type === 'image' && layer.src) {
      const img = new Image()
      img.onload = () => {
        previewCtx.drawImage(img, 0, 0, w, h)
      }
      img.src = layer.src
    }

    if (layer.type === 'remote' && (layer.remoteUrl || layer.remoteType === 'webrtc')) {
      const remoteVideo = createRemoteVideoElement(layer)
      if (remoteVideo && (remoteVideo.readyState >= 2 || layer.remoteType === 'webrtc')) {
        previewCtx.drawImage(remoteVideo, 0, 0, w, h)
      } else {
        previewCtx.fillStyle = 'rgba(0,0,0,0.7)'
        previewCtx.fillRect(0, 0, w, h)
        previewCtx.fillStyle = '#00ffdd'
        previewCtx.font = '16px Arial'
        previewCtx.textAlign = 'center'
        previewCtx.fillText('Conectando stream remoto...', w / 2, h / 2)
      }
    }

    if (layer.type === 'text' && layer.text) {
      previewCtx.fillStyle = layer.fontColor
      previewCtx.font = `${layer.fontSize}px Arial`
      previewCtx.textAlign = 'center'
      previewCtx.fillText(layer.text, w / 2, h / 2)
    }

    // Renderização customizada de plugins (se existir)
    if (layer.pluginName && window.MediaLayersPlugins?.manager) {
      window.MediaLayersPlugins.manager.renderCustomLayer(previewCtx, layer, previewCanvas)
    }
  })

  // Reset compositing
  previewCtx.globalCompositeOperation = 'source-over'
  previewCtx.globalAlpha = 1
}

function createRemoteVideoElement(layer) {
  if (!layer.remoteUrl && layer.remoteType !== 'webrtc') return null

  if (!layer.videoEl) {
    const video = document.createElement('video')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.style.display = 'none'

    if (layer.remoteType === 'webrtc') {
      video.srcObject = layer.remoteStream || new MediaStream()
    } else {
      video.src = layer.remoteUrl
    }

    document.body.appendChild(video)
    layer.videoEl = video

    video.addEventListener('loadeddata', () => {
      if (selectedCell) {
        renderMonitorPreview(selectedCell.row, selectedCell.col)
      }
    })

    video.addEventListener('error', (err) => {
      console.warn('Falha ao carregar stream remoto:', layer.remoteUrl || layer.remoteType, err)
    })
  } else {
    if (layer.remoteType === 'webrtc' && layer.remoteStream) {
      layer.videoEl.srcObject = layer.remoteStream
    }
  }

  return layer.videoEl
}

async function setupWebRTCReceiver(layer) {
  if (!window.io) {
    alert('Socket.IO não encontrado. Instale as dependências.')
    return
  }

  const roomId = prompt('Digite o ID da sala para conectar:', 'room-1')
  if (!roomId) return

  const socket = io('http://localhost:3001')

  socket.on('connect', () => {
    console.log('Conectado ao servidor WebRTC')
    socket.emit('join-room', roomId)
  })

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  })

  layer.remoteStream = layer.remoteStream || new MediaStream()
  const videoEl = createRemoteVideoElement(layer)
  if (videoEl) {
    videoEl.srcObject = layer.remoteStream
  }

  pc.ontrack = (event) => {
    console.log('Track remoto recebido')
    event.streams[0]?.getTracks().forEach(track => {
      layer.remoteStream.addTrack(track)
    })

    if (layer === getLayerById(selectedLayerId)?.layer) {
      renderPreview(selectedCell.row, selectedCell.col)
    }
    if (outputState.program.row !== null) {
      renderMonitorProgram(outputState.program.row, outputState.program.col)
    }
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-candidate', { roomId, candidate: event.candidate })
    }
  }

  // Receber offer
  socket.on('webrtc-offer', async (offer) => {
    console.log('Offer recebida')
    await pc.setRemoteDescription(offer)

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    socket.emit('webrtc-answer', { roomId, answer })
  })

  // Receber candidates
  socket.on('webrtc-candidate', (candidate) => {
    pc.addIceCandidate(candidate)
  })

  socket.on('user-joined', (userId) => {
    console.log('Outro usuário entrou na sala')
  })

  layer.peerConnection = pc
  layer.socket = socket
  layer.roomId = roomId
  layer.remoteType = 'webrtc'

  return pc
}

// ─────────────────────────────────────────────
// RENDER PROPERTIES
// ─────────────────────────────────────────────
function renderProperties() {
  const panel = document.getElementById('properties-panel')
  if (!panel) return

  if (!selectedCell || !selectedLayerId) {
    panel.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Selecione uma camada</div>'
    return
  }

  const cell = grid[selectedCell.row][selectedCell.col]
  const layer = cell.layers.find(l => l.id === selectedLayerId)

  if (!layer) {
    panel.innerHTML = '<div style="color: var(--text-dim);">Layer não encontrada</div>'
    return
  }

  let html = `
    <div class="prop-group">
      <div class="prop-row">
        <label class="prop-label">Nome</label>
        <input type="text" id="prop-name" value="${layer.name}">
      </div>
      
      <div class="prop-row">
        <label class="prop-label">Opacidade</label>
        <input type="range" min="0" max="100" value="${Math.round(layer.opacity * 100)}" id="prop-opacity">
      </div>

      <div class="prop-row">
        <label class="prop-label">Modo de Mistura</label>
        <select id="prop-blend">
          ${Object.keys(BLEND_MODES).map(mode => `
            <option value="${mode}" ${layer.blendMode === mode ? 'selected' : ''}>${mode}</option>
          `).join('')}
        </select>
      </div>
    </div>
  `

  if (layer.type === 'text') {
    html += `
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Texto</label>
          <textarea id="prop-text" style="resize: vertical; min-height: 60px;">${layer.text}</textarea>
        </div>
        <div class="prop-row">
          <label class="prop-label">Tamanho (px)</label>
          <input type="number" id="prop-fontsize" value="${layer.fontSize}" min="8" max="120">
        </div>
        <div class="prop-row">
          <label class="prop-label">Cor</label>
          <input type="color" id="prop-fontcolor" value="${layer.fontColor}">
        </div>
      </div>
    `
  }

  if (layer.type === 'video') {
    html += `
      <div class="prop-group">
        <div class="prop-row">
          <label class="prop-label">Volume</label>
          <input type="range" min="0" max="100" value="${Math.round(layer.volume * 100)}" id="prop-volume">
        </div>
      </div>
    `
  }

  // Painel de propriedades customizadas de plugins
  if (layer.pluginName && window.MediaLayersPlugins?.manager) {
    const pluginProps = window.MediaLayersPlugins.manager.getCustomPropertiesPanel(layer)
    if (pluginProps) {
      html += `<div class="prop-group plugin-properties-panel">${pluginProps}</div>`
    }
  }

  panel.innerHTML = html

  // Event listeners
  document.getElementById('prop-name')?.addEventListener('change', (e) => {
    layer.name = e.target.value
    renderLayersPanel()
  })

  document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
    layer.opacity = parseInt(e.target.value) / 100
    renderPreview(selectedCell.row, selectedCell.col)
  })

  document.getElementById('prop-blend')?.addEventListener('change', (e) => {
    layer.blendMode = e.target.value
    renderPreview(selectedCell.row, selectedCell.col)
  })

  document.getElementById('prop-text')?.addEventListener('change', (e) => {
    layer.text = e.target.value
    renderPreview(selectedCell.row, selectedCell.col)
  })

  document.getElementById('prop-fontsize')?.addEventListener('change', (e) => {
    layer.fontSize = parseInt(e.target.value)
    renderPreview(selectedCell.row, selectedCell.col)
  })

  document.getElementById('prop-fontcolor')?.addEventListener('change', (e) => {
    layer.fontColor = e.target.value
    renderPreview(selectedCell.row, selectedCell.col)
  })

  document.getElementById('prop-volume')?.addEventListener('change', (e) => {
    layer.volume = parseInt(e.target.value) / 100
  })
}

// ─────────────────────────────────────────────
// SETUP PREVIEW CANVAS
// ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
// CANVAS SETUP (Consolidado)
// ═════════════════════════════════════════════════════════════
function setupCanvas(canvasId) {
  const canvas = document.getElementById(canvasId)
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return { canvas, ctx }
  }
  return { canvas: null, ctx: null }
}

function setupPreviewCanvas() {
  const result = setupCanvas('preview-canvas')
  previewCanvas = result.canvas
  previewCtx = result.ctx
}

function setupOutputMonitors() {
  // Monitor Preview (destinado ao operador)
  const previewResult = setupCanvas('monitor-preview')
  monitorPreviewCanvas = previewResult.canvas
  monitorPreviewCtx = previewResult.ctx

  // Monitor Program (saída principal)
  const programResult = setupCanvas('monitor-program')
  monitorProgramCanvas = programResult.canvas
  monitorProgramCtx = programResult.ctx

  // Bot ON AIR
  const btnGoLive = document.getElementById('btn-go-live')
  if (btnGoLive) {
    btnGoLive.addEventListener('click', () => {
      if (outputState.preview.row !== null && outputState.preview.col !== null) {
        sendToProgram()
      }
    })
  }

  // Transição selector
  const transitionType = document.getElementById('transition-type')
  if (transitionType) {
    transitionType.addEventListener('change', (e) => {
      outputState.transition.type = e.target.value
      // Atualizar duração baseado no tipo
      switch (outputState.transition.type) {
        case 'cut': outputState.transition.duration = 0; break
        case 'fade': outputState.transition.duration = 500; break
        case 'dissolve': outputState.transition.duration = 1000; break
      }
    })
  }

  console.log('✓ Output Monitors configurados')
}


// ═════════════════════════════════════════════════════════════
// RENDERIZAR MONITOR PREVIEW (Célula em Preparação)
// ═════════════════════════════════════════════════════════════
function renderMonitorPreview(row, col) {
  if (!monitorPreviewCanvas || !monitorPreviewCtx) return

  const cell = grid[row][col]
  const w = monitorPreviewCanvas.width
  const h = monitorPreviewCanvas.height

  // Limpa canvas
  monitorPreviewCtx.fillStyle = '#000000'
  monitorPreviewCtx.fillRect(0, 0, w, h)

  if (cell.layers.length === 0) {
    monitorPreviewCtx.fillStyle = '#444444'
    monitorPreviewCtx.font = '20px Arial'
    monitorPreviewCtx.textAlign = 'center'
    monitorPreviewCtx.fillText('Preparando...', w / 2, h / 2)
    return
  }

  // Stack-based rendering
  cell.layers.forEach((layer) => {
    if (!layer.visible) return

    monitorPreviewCtx.globalCompositeOperation = BLEND_MODES[layer.blendMode] || 'source-over'
    monitorPreviewCtx.globalAlpha = layer.opacity

    // Renderiza cada tipo
    if (layer.type === 'video' && layer.src) {
      previewCtx.fillStyle = 'rgba(100, 100, 100, 0.5)'
      previewCtx.fillRect(10, 10, w - 20, h - 20)
      previewCtx.fillStyle = '#ffffff'
      previewCtx.font = '16px Arial'
      previewCtx.textAlign = 'center'
      previewCtx.fillText('🎥 ' + layer.name, w / 2, h / 2)
    }

    if (layer.type === 'image' && layer.src) {
      const img = new Image()
      img.onload = () => {
        previewCtx.drawImage(img, 0, 0, w, h)
      }
      img.src = layer.src
    }

    if (layer.type === 'text' && layer.text) {
      previewCtx.fillStyle = layer.fontBg
      previewCtx.fillRect(0, h - 100, w, 100)
      previewCtx.fillStyle = layer.fontColor
      previewCtx.font = `${layer.fontSize}px Arial`
      previewCtx.textAlign = 'center'
      previewCtx.fillText(layer.text, w / 2, h - 30)
    }
  })

  previewCtx.globalCompositeOperation = 'source-over'
  previewCtx.globalAlpha = 1

  // Atualiza info
  const info = document.getElementById('monitor-preview-info')
  if (info) {
    info.textContent = `[${row}, ${col}] • ${cell.layers.length} camadas`
  }
}

// ═════════════════════════════════════════════════════════════
// RENDERIZAR MONITOR PROGRAM (Público)
// ═════════════════════════════════════════════════════════════
function renderMonitorProgram(row, col) {
  if (!monitorProgramCanvas || !monitorProgramCtx) return

  const cell = grid[row][col]
  const w = monitorProgramCanvas.width
  const h = monitorProgramCanvas.height

  // Limpa canvas
  monitorProgramCtx.fillStyle = '#000000'
  monitorProgramCtx.fillRect(0, 0, w, h)

  if (cell.layers.length === 0) {
    monitorProgramCtx.fillStyle = '#333333'
    monitorProgramCtx.font = '20px Arial'
    monitorProgramCtx.textAlign = 'center'
    monitorProgramCtx.fillText('🔴 STANDBY', w / 2, h / 2)
    return
  }

  // Stack-based rendering (mesmo que preview)
  cell.layers.forEach((layer) => {
    if (!layer.visible) return

    monitorProgramCtx.globalCompositeOperation = BLEND_MODES[layer.blendMode] || 'source-over'
    monitorProgramCtx.globalAlpha = layer.opacity

    if (layer.type === 'video' && layer.src) {
      monitorProgramCtx.fillStyle = 'rgba(100, 100, 100, 0.5)'
      monitorProgramCtx.fillRect(10, 10, w - 20, h - 20)
      monitorProgramCtx.fillStyle = '#ffffff'
      monitorProgramCtx.font = '16px Arial'
      monitorProgramCtx.textAlign = 'center'
      monitorProgramCtx.fillText('🎥 ' + layer.name, w / 2, h / 2)
    }

    if (layer.type === 'image' && layer.src) {
      const img = new Image()
      img.onload = () => {
        monitorProgramCtx.drawImage(img, 0, 0, w, h)
      }
      img.src = layer.src
    }

    if (layer.type === 'text' && layer.text) {
      monitorProgramCtx.fillStyle = layer.fontBg
      monitorProgramCtx.fillRect(0, h - 100, w, 100)
      monitorProgramCtx.fillStyle = layer.fontColor
      monitorProgramCtx.font = `${layer.fontSize}px Arial`
      monitorProgramCtx.textAlign = 'center'
      monitorProgramCtx.fillText(layer.text, w / 2, h - 30)
    }

    if (layer.type === 'remote' && (layer.remoteUrl || layer.remoteType === 'webrtc')) {
      const remoteVideo = createRemoteVideoElement(layer)
      if (remoteVideo && (remoteVideo.readyState >= 2 || layer.remoteType === 'webrtc')) {
        monitorProgramCtx.drawImage(remoteVideo, 0, 0, w, h)
      } else {
        monitorProgramCtx.fillStyle = 'rgba(0,0,0,0.7)'
        monitorProgramCtx.fillRect(0, 0, w, h)
        monitorProgramCtx.fillStyle = '#00ffdd'
        monitorProgramCtx.font = '16px Arial'
        monitorProgramCtx.textAlign = 'center'
        monitorProgramCtx.fillText('Conectando stream remoto...', w / 2, h / 2)
      }
    }

    // Renderização customizada de plugins (se existir)
    if (layer.pluginName && window.MediaLayersPlugins?.manager) {
      window.MediaLayersPlugins.manager.renderCustomLayer(monitorProgramCtx, layer, monitorProgramCanvas)
    }
  })

  monitorProgramCtx.globalCompositeOperation = 'source-over'
  monitorProgramCtx.globalAlpha = 1

  // Atualiza info
  const info = document.getElementById('monitor-program-info')
  if (info) {
    info.textContent = `🔴 AO AR: [${row}, ${col}] • ${cell.layers.length} camadas`
  }
}

// ═════════════════════════════════════════════════════════════
// ENVIAR PARA PROGRAM (ON AIR COM TRANSIÇÃO)
// ═════════════════════════════════════════════════════════════
function sendToProgram() {
  if (outputState.preview.row === null || outputState.preview.col === null) return

  const row = outputState.preview.row
  const col = outputState.preview.col
  const transitionType = outputState.transition.type
  const duration = outputState.transition.duration

  // Atualiza estado do program
  outputState.program.row = row
  outputState.program.col = col
  outputState.program.cellId = grid[row][col].id

  // Se transição é cut, já muda
  if (transitionType === 'cut' || duration === 0) {
    renderMonitorProgram(row, col)
    console.log(`✓ Program updated: [${row}, ${col}]`)
  } else {
    // Para transições, aplicar fade/dissolve depois (TODO: implementar interpolação)
    setTimeout(() => {
      renderMonitorProgram(row, col)
    }, duration)
  }

  // Disable botão por um tempo
  const btn = document.getElementById('btn-go-live')
  if (btn) {
    btn.disabled = true
    setTimeout(() => { btn.disabled = false }, duration + 100)
  }
}

// ═════════════════════════════════════════════════════════════
// FASE 4: DRAG & DROP DE MÍDIA (Media Import System)
// ═════════════════════════════════════════════════════════════

// Detecta tipo de mídia baseado no MIME type
function detectMediaType(file) {
  const mimeType = file.type || ''
  
  if (mimeType.startsWith('video/')) {
    return 'video'
  } else if (mimeType.startsWith('image/')) {
    return 'image'
  } else if (mimeType.startsWith('audio/')) {
    return 'audio'
  } else {
    // Fallback: detectar por extensão
    const ext = file.name.split('.').pop().toLowerCase()
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'video'
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return 'image'
    } else if (['mp3', 'wav', 'aac', 'ogg', 'flac'].includes(ext)) {
      return 'audio'
    }
  }
  return null
}

// Adiciona layer a partir de arquivo
function addLayerFromFile(row, col, file) {
  const cell = grid[row][col]
  const mediaType = detectMediaType(file)
  
  if (!mediaType) {
    console.warn(`⚠️ Tipo de arquivo não suportado: ${file.name}`)
    return false
  }
  
  try {
    const src = URL.createObjectURL(file)
    const layer = createLayer(mediaType, file.name, src)
    cell.layers.push(layer)
    
    // Seleciona a nova layer para editar
    selectLayer(layer.id)
    renderLayersPanel()
    renderPreview(row, col)
    
    // Atualizar preview monitor também
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      renderMonitorPreview(row, col)
    }
    
    console.log(`✓ Layer adicionada: ${file.name} (${mediaType})`)
    return true
  } catch (error) {
    console.error('✗ Erro ao adicionar layer:', error)
    return false
  }
}

// Handle arquivo(s) dropados em uma célula
function handleCellDrop(e, row, col) {
  e.preventDefault()
  e.stopPropagation()
  
  const cell = e.currentTarget
  cell.classList.remove('drag-over')
  
  const files = e.dataTransfer.files
  if (!files || files.length === 0) return
  
  // Seleciona a célula primeiro
  selectCell(row, col)
  
  // Adiciona cada arquivo
  let addedCount = 0
  for (let i = 0; i < files.length; i++) {
    if (addLayerFromFile(row, col, files[i])) {
      addedCount++
    }
  }
  
  if (addedCount > 0) {
    console.log(`✓ ${addedCount} arquivo(s) adicionado(s) à célula [${row}, ${col}]`)
  }
}

// Setup listeners de drag/drop para todas as células
function setupDragDropListeners() {
  // Previne o comportamento padrão de arrastar para fora da janela
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  })

  document.addEventListener('drop', (e) => {
    e.preventDefault()
  })

  // Listener Global: grid recebe drop
  const gridEl = document.getElementById('clips-grid')
  if (gridEl) {
    gridEl.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    })

    gridEl.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
  }

  // Listener por célula (renderizado dinamicamente)
  // Precisamos re-aplicar após cada renderGrid()
}

// Aplicar listeners de drag/drop após renderizar células
function setupCellDragDropListeners() {
  document.querySelectorAll('.clip-cell').forEach(cellEl => {
    const row = parseInt(cellEl.dataset.row)
    const col = parseInt(cellEl.dataset.col)
    
    // Quando arrastra SOBRE a célula
    cellEl.addEventListener('dragenter', (e) => {
      e.preventDefault()
      cellEl.classList.add('drag-over')
    })
    
    cellEl.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      cellEl.classList.add('drag-over')
    })
    
    // Quando sai da célula
    cellEl.addEventListener('dragleave', (e) => {
      if (e.target === cellEl) {
        cellEl.classList.remove('drag-over')
      }
    })
    
    // DROPOUT: Soltar arquivo NA CÉLULA
    cellEl.addEventListener('drop', (e) => {
      handleCellDrop(e, row, col)
    })
  })
}

// NOTE: renderGrid já chama setupCellDragDropListeners diretamente para evitar redefinição redundante.

// ═════════════════════════════════════════════════════════════
// FASE 5: MESA DE CORTE / SWITCHER FUNCTIONS
// ═════════════════════════════════════════════════════════════

// Renderizar grid de entradas
function renderInputsGrid() {
  const gridEl = document.getElementById('inputs-grid')
  if (!gridEl) return

  gridEl.innerHTML = ''

  inputs.forEach(input => {
    const itemEl = document.createElement('div')
    itemEl.className = 'input-item'
    itemEl.dataset.inputId = input.id

    if (selectedInputId === input.id) {
      itemEl.classList.add('selected')
    }

    if (input.isLive) {
      itemEl.classList.add('live')
    }

    itemEl.innerHTML = `
      <div class="input-thumbnail">
        ${getInputIcon(input.type)}
      </div>
      <div class="input-label">${input.name}</div>
    `

    itemEl.addEventListener('click', () => selectInput(input.id))

    gridEl.appendChild(itemEl)
  })
}

// Obter ícone para tipo de entrada
function getInputIcon(type) {
  switch (type) {
    case 'camera': return '📷'
    case 'clip': return '🎥'
    case 'ndi': return '📡'
    case 'screen': return '🖥️'
    default: return '🎬'
  }
}

// Selecionar entrada
function selectInput(inputId) {
  selectedInputId = inputId
  renderInputsGrid()
  updateSwitcherInfo()
}

// Adicionar entrada
function addInput(type, name) {
  const input = new InputSource(type, name)
  inputs.push(input)
  renderInputsGrid()
  console.log(`✓ Entrada adicionada: ${name}`)
}

// Atualizar info do switcher
function updateSwitcherInfo() {
  // TODO: Mostrar info da entrada selecionada
}

// TAKE: Enviar entrada selecionada para o ar
function takeInput() {
  if (!selectedInputId) {
    alert('Selecione uma entrada primeiro!')
    return
  }

  const input = inputs.find(i => i.id === selectedInputId)
  if (!input) return

  // Marcar como live
  inputs.forEach(i => i.isLive = false)
  input.isLive = true
  renderInputsGrid()

  // Enviar para saída (simular)
  console.log(`🎬 TAKE: ${input.name} foi para o ar!`)

  // TODO: Integrar com sistema de saída real
  // sendToProgram(input)
}

// Inicializar entradas padrão
function initializeInputs() {
  addInput('camera', 'Câmera 1')
  addInput('camera', 'Câmera 2')
  addInput('clip', 'Clip A')
  addInput('clip', 'Clip B')
  addInput('ndi', 'NDI Stream')
  addInput('screen', 'Tela')
}

// ═════════════════════════════════════════════════════════════
// FASE 6: PLUGINS MANAGEMENT
// ═════════════════════════════════════════════════════════════

// Renderizar lista de plugins
function renderPluginsList() {
  const listEl = document.getElementById('plugins-list')
  if (!listEl || !window.MediaLayersPlugins) return

  listEl.innerHTML = ''

  const plugins = window.MediaLayersPlugins.manager.list()
  plugins.forEach(pluginName => {
    const plugin = window.MediaLayersPlugins.manager.get(pluginName)
    if (!plugin) return

    const itemEl = document.createElement('div')
    itemEl.className = `plugin-item ${plugin.enabled ? 'enabled' : ''}`

    itemEl.innerHTML = `
      <div class="plugin-info">
        <div class="plugin-name">${plugin.name}</div>
        <div class="plugin-meta">v${plugin.version} • ${plugin.author}</div>
      </div>
      <div class="plugin-controls">
        <button class="plugin-btn ${plugin.enabled ? 'disable' : 'enable'}" data-action="${plugin.enabled ? 'disable' : 'enable'}" data-plugin="${pluginName}">
          ${plugin.enabled ? 'Desabilitar' : 'Habilitar'}
        </button>
      </div>
    `

    // Event listeners
    const btn = itemEl.querySelector('.plugin-btn')
    btn.addEventListener('click', () => {
      const action = btn.dataset.action
      const pluginName = btn.dataset.plugin

      if (action === 'enable') {
        window.MediaLayersPlugins.manager.enable(pluginName)
      } else {
        window.MediaLayersPlugins.manager.disable(pluginName)
      }

      renderPluginsList()
      updatePluginsCount()
    })

    listEl.appendChild(itemEl)
  })

  updatePluginsCount()
}

// Atualizar contador de plugins
function updatePluginsCount() {
  const countEl = document.getElementById('plugins-count')
  if (!countEl || !window.MediaLayersPlugins) return

  const loaded = window.MediaLayersPlugins.manager.listLoaded().length
  const total = window.MediaLayersPlugins.manager.list().length

  countEl.textContent = `${loaded}/${total} plugins carregados`
}

function startRenderLoop() {
  function tick() {
    if (outputState.preview.row !== null && outputState.preview.col !== null) {
      renderMonitorPreview(outputState.preview.row, outputState.preview.col)
    }
    if (outputState.program.row !== null && outputState.program.col !== null) {
      renderMonitorProgram(outputState.program.row, outputState.program.col)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))

      btn.classList.add('active')
      document.getElementById(tabName).classList.add('active')

      if (tabName === 'preview-view' && selectedCell) {
        renderPreview(selectedCell.row, selectedCell.col)
      }
    })
  })
}

// ─────────────────────────────────────────────
// CLEAR ALL
// ─────────────────────────────────────────────
function clearAll() {
  if (confirm('Tem certeza? Isso vai deletar TODAS as camadas do grid!')) {
    initializeGrid(gridRows, gridCols)
    selectedCell = null
    selectedLayerId = null
    renderGrid()
    renderLayersPanel()
    renderProperties()
    updateCellInfo()
  }
}

// ─────────────────────────────────────────────
// UPDATE GRID SIZE
// ─────────────────────────────────────────────
function updateGridSize() {
  const rows = parseInt(document.getElementById('grid-rows').value) || 4
  const cols = parseInt(document.getElementById('grid-cols').value) || 6

  initializeGrid(rows, cols)
  selectedCell = null
  selectedLayerId = null
  renderGrid()
  renderLayersPanel()
  renderProperties()
  updateCellInfo()
}

// ═════════════════════════════════════════════════════════════
// FUNÇÕES PARA ADICIONAR/REMOVER LINHAS E COLUNAS DINAMICAMENTE
// ═════════════════════════════════════════════════════════════

function addRow() {
  const newRows = gridRows + 1
  if (newRows > 12) {
    alert('Máximo de 12 linhas atingido')
    return
  }
  
  document.getElementById('grid-rows').value = newRows
  updateGridSize()
  console.log(`✓ Linha adicionada: ${gridRows} linhas`)
}

function removeRow() {
  const newRows = gridRows - 1
  if (newRows < 1) {
    alert('Mínimo de 1 linha requerido')
    return
  }
  
  document.getElementById('grid-rows').value = newRows
  updateGridSize()
  console.log(`✓ Linha removida: ${gridRows} linhas`)
}

function addColumn() {
  const newCols = gridCols + 1
  if (newCols > 12) {
    alert('Máximo de 12 colunas atingido')
    return
  }
  
  document.getElementById('grid-cols').value = newCols
  updateGridSize()
  console.log(`✓ Coluna adicionada: ${gridCols} colunas`)
}

function removeColumn() {
  const newCols = gridCols - 1
  if (newCols < 1) {
    alert('Mínimo de 1 coluna requerido')
    return
  }
  
  document.getElementById('grid-cols').value = newCols
  updateGridSize()
  console.log(`✓ Coluna removida: ${gridCols} colunas`)
}

function resetGrid() {
  document.getElementById('grid-rows').value = 1
  document.getElementById('grid-cols').value = 1
  updateGridSize()
  console.log('✓ Grid resetado para 1×1')
}

// ─────────────────────────────────────────────
// FASE 3: DOCKABLE PANELS
// ─────────────────────────────────────────────
function setupDockablePanels() {
  // Painel esquerdo (Célula Selecionada)
  const leftPanel = new DockablePanel(
    'left',
    'Célula Selecionada',
    document.getElementById('panel-left'),
    0, 0, 280, window.innerHeight
  )

  // Painel direito (Propriedades)
  const rightPanel = new DockablePanel(
    'right',
    'Propriedades',
    document.getElementById('panel-right'),
    window.innerWidth - 260, 0, 260, window.innerHeight
  )

  // Event listeners para botões dos painéis
  document.getElementById('btn-minimize-left')?.addEventListener('click', () => {
    leftPanel.minimize()
  })

  document.getElementById('btn-undock-left')?.addEventListener('click', () => {
    leftPanel.toggleFloat()
  })

  document.getElementById('btn-minimize-right')?.addEventListener('click', () => {
    rightPanel.minimize()
  })

  document.getElementById('btn-undock-right')?.addEventListener('click', () => {
    rightPanel.toggleFloat()
  })

  console.log('✓ Painéis dockable inicializados')
}

// ─────────────────────────────────────────────
// WEBRTC SERVER
// ─────────────────────────────────────────────
function startWebRTCServer() {
  if (window.webrtcServerWindow) {
    window.webrtcServerWindow.focus()
    return
  }

  // Abrir uma nova janela para o servidor WebRTC
  window.webrtcServerWindow = window.open('', 'webrtc-server', 'width=600,height=400')

  if (!window.webrtcServerWindow) {
    alert('Popup bloqueado. Permita popups para iniciar o servidor WebRTC.')
    return
  }

  // HTML da janela do servidor
  const serverHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebRTC Signaling Server</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .server-status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .running { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .stopped { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
        .start { background: #28a745; color: white; }
        .stop { background: #dc3545; color: white; }
        .logs { background: black; color: green; font-family: monospace; padding: 10px; height: 200px; overflow-y: auto; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h2>🚀 WebRTC Signaling Server</h2>
      <div id="status" class="server-status stopped">Servidor parado</div>
      <button class="start" onclick="startServer()">Iniciar Servidor</button>
      <button class="stop" onclick="stopServer()">Parar Servidor</button>
      <h3>Logs:</h3>
      <div id="logs" class="logs"></div>

      <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
      <script>
        let server = null
        let io = null

        function log(message) {
          const logs = document.getElementById('logs')
          logs.textContent += new Date().toLocaleTimeString() + ': ' + message + '\\n'
          logs.scrollTop = logs.scrollHeight
        }

        function startServer() {
          if (server) return

          log('Iniciando servidor WebRTC...')

          // Simular início do servidor (na prática, seria executado no backend)
          fetch('http://localhost:3001/start', { method: 'POST' })
            .then(response => {
              if (response.ok) {
                document.getElementById('status').className = 'server-status running'
                document.getElementById('status').textContent = 'Servidor executando na porta 3001'
                log('Servidor iniciado com sucesso!')
              } else {
                throw new Error('Falha ao iniciar servidor')
              }
            })
            .catch(error => {
              log('Erro: ' + error.message)
              log('Certifique-se de executar: npm run webrtc-server')
            })
        }

        function stopServer() {
          fetch('http://localhost:3001/stop', { method: 'POST' })
            .then(() => {
              document.getElementById('status').className = 'server-status stopped'
              document.getElementById('status').textContent = 'Servidor parado'
              log('Servidor parado')
            })
            .catch(error => log('Erro ao parar servidor: ' + error.message))
        }

        // Verificar status inicial
        fetch('http://localhost:3001/status')
          .then(response => {
            if (response.ok) {
              document.getElementById('status').className = 'server-status running'
              document.getElementById('status').textContent = 'Servidor executando na porta 3001'
            }
          })
          .catch(() => {
            log('Servidor não está executando. Clique em "Iniciar Servidor"')
          })
      </script>
    </body>
    </html>
  `

  window.webrtcServerWindow.document.write(serverHTML)
  window.webrtcServerWindow.document.close()
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
(function init() {
  console.log('🎬 MediaLayers v2 inicializando...')

  // Setup canvas
  setupPreviewCanvas()
  
  // FASE 2: Setup output monitors
  setupOutputMonitors()

  // FASE 3: Setup dockable panels
  setupDockablePanels()

  // FASE 6: Setup plugins
  if (window.registerExamplePlugins) {
    window.registerExamplePlugins()
  }

  // Setup tabs
  setupTabs()

  // Inicializa grid
  initializeGrid(gridRows, gridCols)

  // Renderiza UI
  renderGrid()
  updateCellInfo()

  // FASE 6: Renderizar plugins
  renderPluginsList()
  
  // FASE 2: Renderiza monitores em standby
  const emptyCell = { layers: [] }
  const emptyCanvas = monitorProgramCanvas
  if (emptyCanvas) {
    const ctx = emptyCanvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height)
    ctx.fillStyle = '#333333'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🔴 STANDBY', emptyCanvas.width / 2, emptyCanvas.height / 2)
  }

  // Event listeners - Header controls
  document.getElementById('btn-add-row')?.addEventListener('click', addRow)
  document.getElementById('btn-remove-row')?.addEventListener('click', removeRow)
  document.getElementById('btn-add-col')?.addEventListener('click', addColumn)
  document.getElementById('btn-remove-col')?.addEventListener('click', removeColumn)
  document.getElementById('btn-reset-grid')?.addEventListener('click', resetGrid)
  document.getElementById('btn-clear-all')?.addEventListener('click', clearAll)

  // Event listeners - Media buttons
  document.getElementById('btn-add-video')?.addEventListener('click', () => addMediaLayer('video', 'file-video'))
  document.getElementById('btn-add-image')?.addEventListener('click', () => addMediaLayer('image', 'file-image'))
  document.getElementById('btn-add-audio')?.addEventListener('click', () => addMediaLayer('audio', 'file-audio'))
  document.getElementById('btn-add-text')?.addEventListener('click', addTextLayer)
  document.getElementById('btn-add-camera')?.addEventListener('click', () => alert('TODO: Camera input'))
  document.getElementById('btn-add-remote')?.addEventListener('click', () => addRemoteLayer())
  document.getElementById('btn-start-webrtc-server')?.addEventListener('click', startWebRTCServer)
  document.getElementById('btn-add-plugin-layer')?.addEventListener('click', addPluginLayer)
  startRenderLoop()

  // Event listeners - Preview controls
  document.getElementById('btn-play-preview')?.addEventListener('click', () => {
    if (selectedCell) {
      triggerCell(selectedCell.row, selectedCell.col)
    }
  })

  // ═════════════════════════════════════════════════════════════
  // FASE 5: SETUP SWITCHER
  // ═════════════════════════════════════════════════════════════
  initializeInputs()
  renderInputsGrid()

  // Event listeners - Switcher
  document.getElementById('btn-add-input')?.addEventListener('click', () => {
    const name = prompt('Nome da entrada:', 'Nova Entrada')
    if (name) addInput('clip', name)
  })
  document.getElementById('btn-refresh-inputs')?.addEventListener('click', () => {
    renderInputsGrid()
    console.log('✓ Entradas atualizadas')
  })
  document.getElementById('btn-take')?.addEventListener('click', takeInput)

  // ═════════════════════════════════════════════════════════════
  // FASE 6: SETUP PLUGINS LISTENERS
  // ═════════════════════════════════════════════════════════════
  document.getElementById('btn-refresh-plugins')?.addEventListener('click', () => {
    renderPluginsList()
    console.log('✓ Plugins atualizados')
  })

  document.getElementById('btn-add-plugin')?.addEventListener('click', () => {
    alert('Funcionalidade de instalar plugins será implementada na Fase 7')
  })

  // ═════════════════════════════════════════════════════════════
  // FASE 4: SETUP DRAG & DROP LISTENERS
  // ═════════════════════════════════════════════════════════════
  setupDragDropListeners()

  console.log('✓ MediaLayers v2 pronto!')
})()
