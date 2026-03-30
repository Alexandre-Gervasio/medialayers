// ============================================================
// controller/app.js — Lógica do painel de controle
// Gerencia camadas, preview e comunicação com a saída
// ============================================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// Aqui ficam todas as camadas ativas
// ─────────────────────────────────────────────
let layers = []         // array de objetos de camada
let selectedId = null   // id da camada selecionada
let nextId = 1          // contador de IDs únicos

// ─────────────────────────────────────────────
// REFERÊNCIAS DO DOM
// ─────────────────────────────────────────────
const layersList      = document.getElementById('layers-list')
const propertiesPanel = document.getElementById('properties-content')
const previewBg       = document.getElementById('preview-bg')
const previewMedia    = document.getElementById('preview-media')
const previewText     = document.getElementById('preview-text')

// ─────────────────────────────────────────────
// CRIAR CAMADA
// Cada camada tem: id, tipo, nome, src, opacidade, visível
// ─────────────────────────────────────────────
function createLayer(type, name, src = null) {
  return {
    id:      nextId++,
    type,           // 'video' | 'image' | 'audio' | 'text' | 'camera'
    name,
    src,            // blob URL para mídia, null para texto/câmera
    opacity: 1,     // 0.0 a 1.0
    visible: true,
    // Propriedades extras por tipo
    text:    type === 'text' ? 'Digite o texto aqui' : null,
    fontSize: 48,
    fontColor: '#ffffff',
    fontBg:    'rgba(0,0,0,0.5)',
    loop:    type === 'video',
    volume:  1,
  }
}

// ─────────────────────────────────────────────
// ÍCONE POR TIPO
// ─────────────────────────────────────────────
function iconFor(type) {
  return { video: '🎥', image: '🖼', audio: '🔊', text: '📝', camera: '📷', ndi: '📡' }[type] || '▪'
}

// ─────────────────────────────────────────────
// RENDERIZAR LISTA DE CAMADAS
// ─────────────────────────────────────────────
function renderLayers() {
  layersList.innerHTML = ''

  if (layers.length === 0) {
    layersList.innerHTML = '<li class="layers-empty">Nenhuma camada. Use os botões acima para adicionar.</li>'
    return
  }

  // Renderiza do topo para baixo (última camada = mais acima)
  ;[...layers].reverse().forEach(layer => {
    const li = document.createElement('li')
    li.className = 'layer-item' +
      (layer.id === selectedId ? ' selected' : '') +
      (!layer.visible ? ' muted' : '')
    li.dataset.id = layer.id

    li.innerHTML = `
      <div class="layer-item-top">
        <span class="layer-icon">${iconFor(layer.type)}</span>
        <span class="layer-name" title="${layer.name}">${layer.name}</span>
        <span class="layer-type">${layer.type}</span>
      </div>
      <div class="layer-controls">
        <span class="layer-opacity-label">${Math.round(layer.opacity * 100)}%</span>
        <input type="range" min="0" max="100" value="${Math.round(layer.opacity * 100)}"
          data-id="${layer.id}" class="opacity-slider">
        <button class="layer-btn ${layer.visible ? 'active' : ''}" data-action="toggle" data-id="${layer.id}" title="Mostrar/Ocultar">
          ${layer.visible ? '👁' : '🚫'}
        </button>
        <button class="layer-btn" data-action="delete" data-id="${layer.id}" title="Remover camada">🗑</button>
      </div>
    `

    // Selecionar ao clicar no item
    li.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return
      selectLayer(layer.id)
    })

    layersList.appendChild(li)
  })

  // Eventos dos sliders de opacidade
  document.querySelectorAll('.opacity-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id)
      const layer = layers.find(l => l.id === id)
      if (!layer) return
      layer.opacity = parseInt(e.target.value) / 100
      e.target.previousElementSibling.textContent = e.target.value + '%'
      updatePreview()
      sendToOutput()
    })
  })

  // Eventos dos botões de ação
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id     = parseInt(btn.dataset.id)
      const action = btn.dataset.action
      if (action === 'toggle') toggleLayer(id)
      if (action === 'delete') deleteLayer(id)
    })
  })
}

// ─────────────────────────────────────────────
// SELECIONAR CAMADA
// ─────────────────────────────────────────────
function selectLayer(id) {
  selectedId = id
  renderLayers()
  renderProperties()
}

// ─────────────────────────────────────────────
// ALTERNAR VISIBILIDADE
// ─────────────────────────────────────────────
function toggleLayer(id) {
  const layer = layers.find(l => l.id === id)
  if (!layer) return
  layer.visible = !layer.visible
  renderLayers()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// DELETAR CAMADA
// ─────────────────────────────────────────────
function deleteLayer(id) {
  // Para o stream de câmera se existir
  if (activeStreams[id]) {
    activeStreams[id].getTracks().forEach(t => t.stop())
    delete activeStreams[id]
    // Avisa a saída para remover a câmera
    streamChannel.postMessage({ type: 'camera-remove', layerId: id })
  }
  layers = layers.filter(l => l.id !== id)
  if (selectedId === id) selectedId = null
  renderLayers()
  renderProperties()
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// ADICIONAR CAMADA DE MÍDIA (vídeo/imagem/áudio)
// ─────────────────────────────────────────────
function addMediaLayer(type, fileInputId) {
  const input = document.getElementById(fileInputId)
  input.value = ''
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const src   = URL.createObjectURL(file)
    const layer = createLayer(type, file.name, src)
    layers.push(layer)
    renderLayers()
    selectLayer(layer.id)
    updatePreview()
    sendToOutput()
  }
  input.click()
}

// ─────────────────────────────────────────────
// ADICIONAR CAMADA DE TEXTO
// ─────────────────────────────────────────────
function addTextLayer() {
  const layer = createLayer('text', 'Texto ' + nextId)
  layers.push(layer)
  renderLayers()
  selectLayer(layer.id)
  updatePreview()
  sendToOutput()
}

// ─────────────────────────────────────────────
// BROADCAST CHANNEL — comunicação direta entre janelas
// Usado para enviar streams de câmera (não serializáveis via IPC)
// ─────────────────────────────────────────────
const streamChannel = new BroadcastChannel('medialayers-streams')

// Mapa de streams ativos: { layerId: MediaStream }
const activeStreams = {}

// Envia um stream para a janela de saída via BroadcastChannel
function broadcastStream(layerId, stream, opacity, visible) {
  // BroadcastChannel não envia o stream diretamente,
  // mas podemos usar captureStream em um <video> oculto
  // e repassar via transferable. A solução mais compatível
  // com Electron é: a janela de saída abre o mesmo dispositivo.
  // Enviamos o deviceId e ela abre por conta própria.
  const track = stream.getVideoTracks()[0]
  const settings = track ? track.getSettings() : {}
  streamChannel.postMessage({
    type:      'camera-stream',
    layerId,
    deviceId:  settings.deviceId || null,
    label:     track ? track.label : '',
    opacity,
    visible
  })
}

// ─────────────────────────────────────────────
// ADICIONAR CÂMERA / CAPTURA
// ─────────────────────────────────────────────
async function addCameraLayer() {
  try {
    // Pede permissão primeiro (necessário para ver os labels)
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => {})

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')

    if (videoDevices.length === 0) {
      alert('Nenhuma câmera ou placa de captura encontrada.')
      return
    }

    // Monta lista para o usuário escolher
    let deviceId   = videoDevices[0].deviceId
    let deviceLabel = videoDevices[0].label || 'Câmera 1'

    if (videoDevices.length > 1) {
      const names = videoDevices.map((d, i) =>
        `${i + 1}. ${d.label || 'Câmera ' + (i + 1)}`
      ).join('\n')
      const choice = prompt(`Dispositivos encontrados:\n${names}\n\nDigite o número:`, '1')
      const idx = parseInt(choice) - 1
      if (isNaN(idx) || idx < 0 || idx >= videoDevices.length) return
      deviceId    = videoDevices[idx].deviceId
      deviceLabel = videoDevices[idx].label || 'Câmera ' + (idx + 1)
    }

    // Abre o stream no painel de controle (para preview)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: 1920, height: 1080 },
      audio: false
    })

    const layer      = createLayer('camera', deviceLabel)
    layer.stream     = stream
    layer.deviceId   = deviceId   // guarda o deviceId para repassar à saída
    activeStreams[layer.id] = stream

    layers.push(layer)
    renderLayers()
    selectLayer(layer.id)
    updatePreview()

    // Envia o deviceId para a janela de saída abrir o mesmo dispositivo
    broadcastStream(layer.id, stream, layer.opacity, layer.visible)
    sendToOutput()

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      alert('Permissão de câmera negada. Verifique as permissões do sistema.')
    } else if (err.name === 'NotFoundError') {
      alert('Dispositivo não encontrado. Verifique se está conectado.')
    } else {
      alert('Erro ao acessar câmera: ' + err.message)
    }
  }
}

// ─────────────────────────────────────────────
// ATUALIZAR PREVIEW
// Reflete o estado das camadas na janela de preview
// ─────────────────────────────────────────────
function updatePreview() {
  // Limpa o preview
  previewBg.innerHTML    = ''
  previewMedia.innerHTML = ''
  previewText.innerHTML  = ''

  // Esconde o placeholder se tiver camadas visíveis
  const placeholder = document.querySelector('.preview-placeholder')
  const hasVisible  = layers.some(l => l.visible)
  placeholder.style.display = hasVisible ? 'none' : 'flex'

  layers.forEach(layer => {
    if (!layer.visible) return

    if (layer.type === 'video' && layer.src) {
      const el = document.createElement('video')
      el.src    = layer.src
      el.loop   = layer.loop
      el.muted  = true  // preview é sempre mudo
      el.autoplay = true
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewBg.appendChild(el)
    }

    if (layer.type === 'image' && layer.src) {
      const el = document.createElement('img')
      el.src = layer.src
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewBg.appendChild(el)
    }

    if (layer.type === 'camera' && layer.stream) {
      const el = document.createElement('video')
      el.srcObject = layer.stream
      el.autoplay  = true
      el.muted     = true
      el.style.opacity = layer.opacity
      el.style.cssText += '; position:absolute; inset:0; width:100%; height:100%; object-fit:contain;'
      previewBg.appendChild(el)
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
// PAINEL DE PROPRIEDADES
// Mostra os controles da camada selecionada
// ─────────────────────────────────────────────
function renderProperties() {
  const layer = layers.find(l => l.id === selectedId)

  if (!layer) {
    propertiesPanel.className = 'properties-empty'
    propertiesPanel.innerHTML = '<span>Selecione uma camada para editar suas propriedades.</span>'
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
        <label class="prop-label">Tamanho da fonte (px)</label>
        <input type="number" id="prop-fontsize" value="${layer.fontSize}" min="10" max="200">
      </div>
      <div class="prop-row">
        <label class="prop-label">Cor do texto</label>
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
      <div class="prop-row">
        <label class="prop-label">Loop</label>
        <select id="prop-loop">
          <option value="true"  ${layer.loop ? 'selected' : ''}>Ativado</option>
          <option value="false" ${!layer.loop ? 'selected' : ''}>Desativado</option>
        </select>
      </div>
    `
  }

  propertiesPanel.innerHTML = html

  // Eventos das propriedades
  document.getElementById('prop-name').addEventListener('input', e => {
    layer.name = e.target.value
    renderLayers()
  })

  document.getElementById('prop-opacity').addEventListener('input', e => {
    layer.opacity = parseInt(e.target.value) / 100
    updatePreview()
    sendToOutput()
    renderLayers()
  })

  const propText = document.getElementById('prop-text')
  if (propText) {
    propText.addEventListener('input', e => {
      layer.text = e.target.value
      updatePreview()
      sendToOutput()
    })
  }

  const propFontSize = document.getElementById('prop-fontsize')
  if (propFontSize) {
    propFontSize.addEventListener('input', e => {
      layer.fontSize = parseInt(e.target.value)
      updatePreview()
      sendToOutput()
    })
  }

  const propFontColor = document.getElementById('prop-fontcolor')
  if (propFontColor) {
    propFontColor.addEventListener('input', e => {
      layer.fontColor = e.target.value
      updatePreview()
      sendToOutput()
    })
  }

  const propVolume = document.getElementById('prop-volume')
  if (propVolume) {
    propVolume.addEventListener('input', e => {
      layer.volume = parseInt(e.target.value) / 100
      sendToOutput()
    })
  }

  const propLoop = document.getElementById('prop-loop')
  if (propLoop) {
    propLoop.addEventListener('change', e => {
      layer.loop = e.target.value === 'true'
      sendToOutput()
    })
  }
}

// ─────────────────────────────────────────────
// MONITORES
// ─────────────────────────────────────────────
let displays       = []
let activeDisplays = []

async function loadDisplays() {
  displays = await window.mediaLayers.getDisplays()
  renderDisplayPanel()
}

function renderDisplayPanel() {
  let panel = document.getElementById('display-panel')
  if (!panel) {
    panel = document.createElement('div')
    panel.id = 'display-panel'
    panel.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      background: #0f3460; border-radius: 8px;
      padding: 4px 10px; margin-right: 8px;
    `
    const headerRight = document.querySelector('.header-right')
    headerRight.insertBefore(panel, headerRight.firstChild)
  }

  panel.innerHTML = '<span style="font-size:0.7rem;color:#888;margin-right:4px;">MONITORES</span>'

  displays.forEach((d, i) => {
    const btn = document.createElement('button')
    const isActive = activeDisplays.includes(d.id)
    btn.className = 'btn btn-sm'
    btn.title = `${d.width}×${d.height} (${d.isPrimary ? 'Principal' : 'Secundário'})`
    btn.style.cssText = `
      background: ${isActive ? '#4ade80' : '#1a2a4a'};
      color: ${isActive ? '#000' : '#888'};
      font-size: 11px; padding: 3px 8px;
    `
    btn.textContent = `🖥 ${d.isPrimary ? 'P' : i}`
    btn.addEventListener('click', () => toggleDisplay(d.id, isActive))
    panel.appendChild(btn)
  })
}

async function toggleDisplay(displayId, isCurrentlyActive) {
  if (isCurrentlyActive) {
    await window.mediaLayers.closeOutput(displayId)
    activeDisplays = activeDisplays.filter(id => id !== displayId)
  } else {
    await window.mediaLayers.openOutput(displayId)
    activeDisplays.push(displayId)
  }
  renderDisplayPanel()
}

window.mediaLayers.onOutputsUpdated((ids) => {
  activeDisplays = ids
  renderDisplayPanel()
})

// ─────────────────────────────────────────────
// ENVIAR ESTADO PARA A JANELA DE SAÍDA
// ─────────────────────────────────────────────
function sendToOutput() {
  const payload = layers.map(l => ({
    id:        l.id,
    type:      l.type,
    name:      l.name,
    src:       l.src || null,
    deviceId:  l.deviceId || null,   // para câmeras
    opacity:   l.opacity,
    visible:   l.visible,
    text:      l.text,
    fontSize:  l.fontSize,
    fontColor: l.fontColor,
    fontBg:    l.fontBg,
    loop:      l.loop,
    volume:    l.volume,
  }))
  window.mediaLayers.sendToOutput({ type: 'update-layers', layers: payload, targetDisplay: 'all' })
}

// ─────────────────────────────────────────────
// LIMPAR SAÍDA
// ─────────────────────────────────────────────
function clearOutput() {
  window.mediaLayers.sendToOutput({ type: 'clear', targetDisplay: 'all' })
}

// ─────────────────────────────────────────────
// EVENTOS DOS BOTÕES DE ADICIONAR
// ─────────────────────────────────────────────
document.getElementById('btn-add-video') .addEventListener('click', () => addMediaLayer('video',  'file-video'))
document.getElementById('btn-add-image') .addEventListener('click', () => addMediaLayer('image',  'file-image'))
document.getElementById('btn-add-audio') .addEventListener('click', () => addMediaLayer('audio',  'file-audio'))
document.getElementById('btn-add-text')  .addEventListener('click', addTextLayer)
document.getElementById('btn-add-camera').addEventListener('click', addCameraLayer)

document.getElementById('btn-send-all').addEventListener('click', () => {
  updatePreview()
  sendToOutput()
})

document.getElementById('btn-clear-all').addEventListener('click', () => {
  clearOutput()
})

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
renderLayers()
loadDisplays()
console.log('[MediaLayers] Painel de controle iniciado.')

