// ============================================================
// controller/app-resolume.js
// Novo sistema de camadas RESOLUME ARENA
// ============================================================
// ARQUITETURA:
//   columns[]
//     ├─ column.id
//     ├─ column.name ("Coluna 1", etc)
//     ├─ column.layers[] (array de layers)
//     └─ column.isActive (qual coluna está selecionada)
// ============================================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL - RESOLUME STRUCTURE
// ─────────────────────────────────────────────
let columns         = []          // Array de colunas (composições)
let nextColumnId    = 1           // Contador de IDs de colunas
let nextLayerId     = 1000        // Contador de IDs de layers
let selectedColumnId = null       // Qual coluna está ativa
let selectedLayerId  = null       // Qual layer está selecionado (dentro da coluna ativa)

// ─────────────────────────────────────────────
// REFERÊNCIAS DO DOM
// ─────────────────────────────────────────────
const columnsContainer    = document.getElementById('columns-container')
const layerAddButtons     = document.getElementById('layer-add-buttons')
const propertiesPanel     = document.getElementById('properties-content')
const previewScreen       = document.getElementById('preview-screen')

// Para a saída (output window)
const streamChannel       = new BroadcastChannel('medialayers-streams')
const activeStreams       = {} // { layerId: MediaStream }

// ─────────────────────────────────────────────
// CRIAR COLUNA (Composição/Sequência)
// ─────────────────────────────────────────────
function createColumn(name = null) {
  return {
    id:        nextColumnId++,
    name:      name || `Coluna ${nextColumnId}`,
    layers:    [],
    isActive:  false,
  }
}

// ─────────────────────────────────────────────
// CRIAR LAYER (agora dentro de uma coluna)
// ─────────────────────────────────────────────
function createLayer(type, name, src = null) {
  return {
    id:       nextLayerId++,
    type,           // 'video' | 'image' | 'audio' | 'text' | 'camera'
    name,
    src,            // blob URL para mídia
    opacity:  1,    // 0.0 a 1.0
    visible:  true,
    // Props por tipo
    text:     type === 'text' ? 'Digite o texto aqui' : null,
    fontSize: 48,
    fontColor: '#ffffff',
    fontBg:   'rgba(0,0,0,0.5)',
    loop:     type === 'video',
    volume:   1,
  }
}

// ─────────────────────────────────────────────
// ÍCONE POR TIPO
// ─────────────────────────────────────────────
function iconFor(type) {
  return { video: '🎥', image: '🖼', audio: '🔊', text: '📝', camera: '📷', ndi: '📡' }[type] || '▪'
}

// ─────────────────────────────────────────────
// RENDERIZAR COLUNAS (RESOLUME LAYOUT)
// ─────────────────────────────────────────────
function renderColumns() {
  columnsContainer.innerHTML = ''

  if (columns.length === 0) {
    columnsContainer.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">Clique em ➕ Coluna para começar</div>'
    return
  }

  // Renderiza cada coluna como um card vertical
  columns.forEach(column => {
    const columnEl = document.createElement('div')
    columnEl.className = `column ${column.id === selectedColumnId ? 'selected' : ''}`
    columnEl.dataset.columnId = column.id

    // Cabeçalho da coluna
    const header = document.createElement('div')
    header.className = 'column-header'
    header.innerHTML = `
      <span class="column-name">${column.name}</span>
      <div class="column-actions">
        <button class="column-btn" data-action="rename" data-id="${column.id}" title="Renomear">✏</button>
        <button class="column-btn" data-action="delete-column" data-id="${column.id}" title="Remover coluna">🗑</button>
      </div>
    `

    // Ao clicar no cabeçalho, ativa a coluna
    header.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        selectColumn(column.id)
      }
    })

    // Lista de layers da coluna
    const layersList = document.createElement('ul')
    layersList.className = `column-layers ${column.layers.length === 0 ? 'empty' : ''}`

    if (column.layers.length === 0) {
      layersList.innerHTML = '<div style="width: 100%; text-align: center;">Camadas</div>'
    } else {
      // Renderiza layers de trás para frente (último = mais acima na pilha)
      ;[...column.layers].reverse().forEach(layer => {
        const li = document.createElement('li')
        li.className = `column-layer-item ${layer.id === selectedLayerId ? 'selected' : ''} ${!layer.visible ? 'muted' : ''}`
        li.dataset.layerId = layer.id

        li.innerHTML = `
          <span class="column-layer-icon">${iconFor(layer.type)}</span>
          <span class="column-layer-name" title="${layer.name}">${layer.name}</span>
        `

        li.addEventListener('click', () => selectLayer(column.id, layer.id))

        // Context: botões de ação inline
        const actions = document.createElement('div')
        actions.style.marginLeft = 'auto'
        actions.style.display = 'flex'
        actions.style.gap = '2px'

        const eyeBtn = document.createElement('button')
        eyeBtn.className = `layer-btn ${layer.visible ? 'active' : ''}`
        eyeBtn.title = 'Mostrar/Ocultar'
        eyeBtn.textContent = layer.visible ? '👁' : '🚫'
        eyeBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          toggleLayerVisibility(column.id, layer.id)
        })

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'layer-btn'
        deleteBtn.title = 'Remover'
        deleteBtn.textContent = '🗑'
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          deleteLayer(column.id, layer.id)
        })

        actions.appendChild(eyeBtn)
        actions.appendChild(deleteBtn)
        li.appendChild(actions)

        layersList.appendChild(li)
      })
    }

    columnEl.appendChild(header)
    columnEl.appendChild(layersList)
    columnsContainer.appendChild(columnEl)
  })

  // Event listeners para os botões de ação das colunas
  document.querySelectorAll('[data-action="rename"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = parseInt(btn.dataset.id)
      renameColumn(id)
    })
  })

  document.querySelectorAll('[data-action="delete-column"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = parseInt(btn.dataset.id)
      deleteColumn(id)
    })
  })

  // Mostra/esconde toolbar de adicionar layers
  if (selectedColumnId !== null) {
    layerAddButtons.style.display = 'flex'
  } else {
    layerAddButtons.style.display = 'none'
  }
}

// ─────────────────────────────────────────────
// SELECIONAR COLUNA
// ─────────────────────────────────────────────
function selectColumn(columnId) {
  selectedColumnId = columnId
  selectedLayerId = null  // Reset layer selection
  renderColumns()
  renderProperties()
}

// ─────────────────────────────────────────────
// ADICIONAR COLUNA
// ─────────────────────────────────────────────
function addColumn() {
  const newColumn = createColumn()
  columns.push(newColumn)
  selectColumn(newColumn.id)
  renderColumns()
}

// ─────────────────────────────────────────────
// RENOMEAR COLUNA
// ─────────────────────────────────────────────
function renameColumn(columnId) {
  const column = columns.find(c => c.id === columnId)
  if (!column) return

  const newName = prompt('Novo nome da coluna:', column.name)
  if (newName && newName.trim()) {
    column.name = newName.trim()
    renderColumns()
  }
}

// ─────────────────────────────────────────────
// DELETE COLUNA
// ─────────────────────────────────────────────
function deleteColumn(columnId) {
  if (columns.length === 1) {
    alert('Você deve ter ao menos uma coluna!')
    return
  }

  // Stop streams ativos
  const column = columns.find(c => c.id === columnId)
  if (column) {
    column.layers.forEach(layer => {
      if (activeStreams[layer.id]) {
        activeStreams[layer.id].getTracks().forEach(t => t.stop())
        delete activeStreams[layer.id]
      }
    })
  }

  columns = columns.filter(c => c.id !== columnId)
  if (selectedColumnId === columnId) {
    selectedColumnId = columns[0]?.id || null
  }
  selectedLayerId = null

  renderColumns()
  renderProperties()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// SELECIONAR LAYER (dentro de uma coluna)
// ─────────────────────────────────────────────
function selectLayer(columnId, layerId) {
  selectedColumnId = columnId
  selectedLayerId = layerId
  renderColumns()
  renderProperties()
}

// ─────────────────────────────────────────────
// ADICIONAR LAYER DE MÍDIA à coluna ativa
// ─────────────────────────────────────────────
function addMediaLayer(type, fileInputId) {
  if (selectedColumnId === null) {
    alert('Selecione ou crie uma coluna primeiro!')
    return
  }

  const column = columns.find(c => c.id === selectedColumnId)
  if (!column) return

  const input = document.getElementById(fileInputId)
  input.value = ''
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const src = URL.createObjectURL(file)
    const layer = createLayer(type, file.name, src)
    column.layers.push(layer)

    selectLayer(selectedColumnId, layer.id)
    renderColumns()
    updatePreview()
    sendToOutput()
  }
  input.click()
}

// ─────────────────────────────────────────────
// ADICIONAR LAYER DE TEXTO
// ─────────────────────────────────────────────
function addTextLayer() {
  if (selectedColumnId === null) {
    alert('Selecione ou crie uma coluna primeiro!')
    return
  }

  const column = columns.find(c => c.id === selectedColumnId)
  if (!column) return

  const layer = createLayer('text', `Texto ${nextLayerId}`)
  column.layers.push(layer)

  selectLayer(selectedColumnId, layer.id)
  renderColumns()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// TOGGLE VISIBILIDADE DO LAYER
// ─────────────────────────────────────────────
function toggleLayerVisibility(columnId, layerId) {
  const column = columns.find(c => c.id === columnId)
  const layer = column?.layers.find(l => l.id === layerId)
  if (!layer) return

  layer.visible = !layer.visible
  renderColumns()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// DELETE LAYER
// ─────────────────────────────────────────────
function deleteLayer(columnId, layerId) {
  const column = columns.find(c => c.id === columnId)
  if (!column) return

  // Stop stream se for câmera
  if (activeStreams[layerId]) {
    activeStreams[layerId].getTracks().forEach(t => t.stop())
    delete activeStreams[layerId]
    streamChannel.postMessage({ type: 'camera-remove', layerId })
  }

  column.layers = column.layers.filter(l => l.id !== layerId)

  if (selectedLayerId === layerId) {
    selectedLayerId = null
  }

  renderColumns()
  renderProperties()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// ADICIONAR CÂMERA à coluna ativa
// ─────────────────────────────────────────────
async function addCameraLayer() {
  if (selectedColumnId === null) {
    alert('Selecione ou crie uma coluna primeiro!')
    return
  }

  const column = columns.find(c => c.id === selectedColumnId)
  if (!column) return

  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => {})

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    if (videoDevices.length === 0) {
      alert('Nenhuma câmera encontrada.')
      return
    }

    let deviceId = videoDevices[0].deviceId
    let deviceLabel = videoDevices[0].label || 'Câmera 1'

    if (videoDevices.length > 1) {
      const names = videoDevices.map((d, i) =>
        `${i + 1}. ${d.label || 'Câmera ' + (i + 1)}`
      ).join('\n')
      const choice = prompt(`Dispositivos:\n${names}\n\nEscolha:`, '1')
      const idx = parseInt(choice) - 1
      if (isNaN(idx) || idx < 0 || idx >= videoDevices.length) return
      deviceId = videoDevices[idx].deviceId
      deviceLabel = videoDevices[idx].label || 'Câmera ' + (idx + 1)
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: 1920, height: 1080 },
      audio: false
    })

    const layer = createLayer('camera', deviceLabel)
    layer.stream = stream
    layer.deviceId = deviceId
    activeStreams[layer.id] = stream

    column.layers.push(layer)
    selectLayer(selectedColumnId, layer.id)
    renderColumns()
    updatePreview()

    streamChannel.postMessage({
      type: 'camera-stream',
      layerId: layer.id,
      deviceId: deviceId,
      label: deviceLabel,
      opacity: layer.opacity,
      visible: layer.visible
    })
    sendToOutput()

  } catch (err) {
    alert('Erro ao acessar câmera: ' + err.message)
  }
}

// ─────────────────────────────────────────────
// UPDATE PREVIEW
// Renderiza a coluna ativa no preview
// ─────────────────────────────────────────────
function updatePreview() {
  previewScreen.querySelectorAll('.preview-layer').forEach(el => el.innerHTML = '')

  const activeColumn = columns.find(c => c.id === selectedColumnId)
  if (!activeColumn) return

  const previewMedia = previewScreen.querySelector('#preview-media')
  const previewText = previewScreen.querySelector('#preview-text')
  if (!previewMedia || !previewText) return

  previewMedia.innerHTML = ''
  previewText.innerHTML = ''

  const hasVisible = activeColumn.layers.some(l => l.visible)
  const placeholder = previewScreen.querySelector('.preview-placeholder')
  if (placeholder) placeholder.style.display = hasVisible ? 'none' : 'flex'

  activeColumn.layers.forEach(layer => {
    if (!layer.visible) return

    if (layer.type === 'video' && layer.src) {
      const el = document.createElement('video')
      el.src = layer.src
      el.loop = layer.loop
      el.muted = true
      el.autoplay = true
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewMedia.appendChild(el)
    }

    if (layer.type === 'image' && layer.src) {
      const el = document.createElement('img')
      el.src = layer.src
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewMedia.appendChild(el)
    }

    if (layer.type === 'camera' && layer.stream) {
      const el = document.createElement('video')
      el.srcObject = layer.stream
      el.autoplay = true
      el.muted = true
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewMedia.appendChild(el)
    }

    if (layer.type === 'text' && layer.text) {
      const el = document.createElement('div')
      el.textContent = layer.text
      el.style.cssText = `
        color: ${layer.fontColor};
        font-size: ${Math.round(layer.fontSize * 0.3)}px;
        background: ${layer.fontBg};
        padding: 4px 10px;
        border-radius: 4px;
        text-align: center;
        opacity: ${layer.opacity};
        max-width: 90%;
        word-wrap: break-word;
      `
      previewText.appendChild(el)
    }
  })
}

// ─────────────────────────────────────────────
// RENDER PROPERTIES
// Exibe props da camada selecionada
// ─────────────────────────────────────────────
function renderProperties() {
  const column = columns.find(c => c.id === selectedColumnId)
  const layer = column?.layers.find(l => l.id === selectedLayerId)

  if (!layer) {
    propertiesPanel.className = 'properties-empty'
    propertiesPanel.innerHTML = '<span>Selecione uma camada para editar.</span>'
    return
  }

  propertiesPanel.className = 'prop-group'

  let html = `
    <div class="prop-row">
      <label class="prop-label">Nome</label>
      <input type="text" id="prop-name" value="${layer.name}">
    </div>
    <div class="prop-row">
      <label class="prop-label">Opacidade</label>
      <input type="range" min="0" max="100" value="${Math.round(layer.opacity * 100)}" id="prop-opacity">
    </div>
  `

  if (layer.type === 'text') {
    html += `
      <div class="prop-row">
        <label class="prop-label">Texto</label>
        <textarea id="prop-text">${layer.text}</textarea>
      </div>
      <div class="prop-row">
        <label class="prop-label">Tamanho (px)</label>
        <input type="number" id="prop-fontsize" value="${layer.fontSize}" min="10" max="200">
      </div>
      <div class="prop-row">
        <label class="prop-label">Cor</label>
        <input type="color" id="prop-fontcolor" value="${layer.fontColor}">
      </div>
    `
  }

  if (layer.type === 'video') {
    html += `
      <div class="prop-row">
        <label class="prop-label">Volume</label>
        <input type="range" min="0" max="100" value="${Math.round(layer.volume * 100)}" id="prop-volume">
      </div>
    `
  }

  propertiesPanel.innerHTML = html

  // Event listeners para as props
  const nameInput = document.getElementById('prop-name')
  const opacityInput = document.getElementById('prop-opacity')
  const textInput = document.getElementById('prop-text')
  const fontsizeInput = document.getElementById('prop-fontsize')
  const fontcolorInput = document.getElementById('prop-fontcolor')
  const volumeInput = document.getElementById('prop-volume')

  if (nameInput) nameInput.addEventListener('change', (e) => {
    layer.name = e.target.value
    renderColumns()
  })

  if (opacityInput) opacityInput.addEventListener('input', (e) => {
    layer.opacity = parseInt(e.target.value) / 100
    updatePreview()
    sendToOutput()
  })

  if (textInput) textInput.addEventListener('change', (e) => {
    layer.text = e.target.value
    updatePreview()
    sendToOutput()
  })

  if (fontsizeInput) fontsizeInput.addEventListener('change', (e) => {
    layer.fontSize = parseInt(e.target.value)
    updatePreview()
    sendToOutput()
  })

  if (fontcolorInput) fontcolorInput.addEventListener('change', (e) => {
    layer.fontColor = e.target.value
    updatePreview()
    sendToOutput()
  })

  if (volumeInput) volumeInput.addEventListener('input', (e) => {
    layer.volume = parseInt(e.target.value) / 100
    sendToOutput()
  })
}

// ─────────────────────────────────────────────
// SEND TO OUTPUT (janela de saída)
// Envia todas as layers da coluna ativa
// ─────────────────────────────────────────────
function sendToOutput() {
  const activeColumn = columns.find(c => c.id === selectedColumnId)
  if (!activeColumn) return

  const layersData = activeColumn.layers.map(layer => ({
    id: layer.id,
    type: layer.type,
    src: layer.src,
    opacity: layer.opacity,
    visible: layer.visible,
    text: layer.text,
    fontSize: layer.fontSize,
    fontColor: layer.fontColor,
    fontBg: layer.fontBg,
    loop: layer.loop,
    volume: layer.volume,
  }))

  window.mediaLayers.sendLayers(layersData)
}

// ─────────────────────────────────────────────
// INIT UI EVENTS
// ─────────────────────────────────────────────
document.getElementById('btn-add-column')?.addEventListener('click', addColumn)
document.getElementById('btn-add-video')?.addEventListener('click', () => addMediaLayer('video', 'file-video'))
document.getElementById('btn-add-image')?.addEventListener('click', () => addMediaLayer('image', 'file-image'))
document.getElementById('btn-add-audio')?.addEventListener('click', () => addMediaLayer('audio', 'file-audio'))
document.getElementById('btn-add-text')?.addEventListener('click', addTextLayer)
document.getElementById('btn-add-camera')?.addEventListener('click', addCameraLayer)

// ─────────────────────────────────────────────
// INIT (criar primeira coluna)
// ─────────────────────────────────────────────
(function init() {
  const firstColumn = createColumn('Composição 1')
  columns.push(firstColumn)
  selectColumn(firstColumn.id)
  renderColumns()
  updatePreview()
})()
