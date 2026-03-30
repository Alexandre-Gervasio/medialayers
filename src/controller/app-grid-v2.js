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
let gridRows = 4                 // Linhas do grid
let gridCols = 6                 // Colunas do grid
let selectedCell = null          // {row, col} célula selecionada
let selectedLayerId = null       // ID da layer selecionada
let nextId = 1

// Streams ativos (câmeras)
const activeStreams = {}
const streamChannel = new BroadcastChannel('medialayers-streams')

// Canvas preview
let previewCanvas = null
let previewCtx = null

// ═════════════════════════════════════════════════════════════
// FASE 2: MONITORES DE SAÍDA (Preview + Program)
// ═════════════════════════════════════════════════════════════
let monitorPreviewCanvas = null
let monitorPreviewCtx = null
let monitorProgramCanvas = null
let monitorProgramCtx = null

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
function createLayer(type, name, src = null) {
  return {
    id: nextId++,
    type,             // 'video' | 'image' | 'text' | 'audio' | 'camera'
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

    if (layer.type === 'text' && layer.text) {
      previewCtx.fillStyle = layer.fontColor
      previewCtx.font = `${layer.fontSize}px Arial`
      previewCtx.textAlign = 'center'
      previewCtx.fillText(layer.text, w / 2, h / 2)
    }
  })

  // Reset compositing
  previewCtx.globalCompositeOperation = 'source-over'
  previewCtx.globalAlpha = 1
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
function setupPreviewCanvas() {
  previewCanvas = document.getElementById('preview-canvas')
  if (previewCanvas) {
    previewCtx = previewCanvas.getContext('2d')
    previewCtx.fillStyle = '#000000'
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
  }
}

// ═════════════════════════════════════════════════════════════
// FASE 2: SETUP OUTPUT MONITORS
// ═════════════════════════════════════════════════════════════
function setupOutputMonitors() {
  monitorPreviewCanvas = document.getElementById('monitor-preview')
  if (monitorPreviewCanvas) {
    monitorPreviewCtx = monitorPreviewCanvas.getContext('2d')
    monitorPreviewCtx.fillStyle = '#000000'
    monitorPreviewCtx.fillRect(0, 0, monitorPreviewCanvas.width, monitorPreviewCanvas.height)
  }

  monitorProgramCanvas = document.getElementById('monitor-program')
  if (monitorProgramCanvas) {
    monitorProgramCtx = monitorProgramCanvas.getContext('2d')
    monitorProgramCtx.fillStyle = '#000000'
    monitorProgramCtx.fillRect(0, 0, monitorProgramCanvas.width, monitorProgramCanvas.height)
  }

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
      monitorPreviewCtx.fillStyle = 'rgba(100, 100, 100, 0.5)'
      monitorPreviewCtx.fillRect(10, 10, w - 20, h - 20)
      monitorPreviewCtx.fillStyle = '#ffffff'
      monitorPreviewCtx.font = '16px Arial'
      monitorPreviewCtx.textAlign = 'center'
      monitorPreviewCtx.fillText('🎥 ' + layer.name, w / 2, h / 2)
    }

    if (layer.type === 'image' && layer.src) {
      const img = new Image()
      img.onload = () => {
        monitorPreviewCtx.drawImage(img, 0, 0, w, h)
      }
      img.src = layer.src
    }

    if (layer.type === 'text' && layer.text) {
      monitorPreviewCtx.fillStyle = layer.fontBg
      monitorPreviewCtx.fillRect(0, h - 100, w, 100)
      monitorPreviewCtx.fillStyle = layer.fontColor
      monitorPreviewCtx.font = `${layer.fontSize}px Arial`
      monitorPreviewCtx.textAlign = 'center'
      monitorPreviewCtx.fillText(layer.text, w / 2, h - 30)
    }
  })

  monitorPreviewCtx.globalCompositeOperation = 'source-over'
  monitorPreviewCtx.globalAlpha = 1

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

// Modificar renderGrid para chamar setupCellDragDropListeners()
const originalRenderGrid = renderGrid
function renderGrid() {
  originalRenderGrid()
  setupCellDragDropListeners()  // Re-aplicar listeners após renderizar
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
  document.getElementById('grid-rows').value = 4
  document.getElementById('grid-cols').value = 6
  updateGridSize()
  console.log('✓ Grid resetado para 4×6')
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

  // Setup tabs
  setupTabs()

  // Inicializa grid
  initializeGrid(gridRows, gridCols)

  // Renderiza UI
  renderGrid()
  updateCellInfo()
  
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

  // Event listeners - Preview controls
  document.getElementById('btn-play-preview')?.addEventListener('click', () => {
    if (selectedCell) {
      triggerCell(selectedCell.row, selectedCell.col)
    }
  })

  // ═════════════════════════════════════════════════════════════
  // FASE 4: SETUP DRAG & DROP LISTENERS
  // ═════════════════════════════════════════════════════════════
  setupDragDropListeners()

  console.log('✓ MediaLayers v2 pronto!')
})()
