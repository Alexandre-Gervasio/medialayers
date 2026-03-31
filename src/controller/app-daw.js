console.log('[DAW] app-daw loaded')

if (typeof window !== 'undefined' && window.jQuery) {
  window.$ = window.jQuery
}

const outputConfig = {
  width: 1280,
  height: 720,
  fps: 15
}

const LAYOUT_STORAGE_KEY = 'medialayers-golden-layout-v3'

const state = {
  goldenLayout: null,
  layers: [],
  nextLayerId: 1,
  selectedLayerId: null,
  previewLayerId: null,
  programLayerIds: [],
  ndiAvailable: false,
  ndiSources: [],
  ndiActiveReceivers: {},
  renderLoopId: null,
  ndiOutputActive: false,
  ndiOutputInterval: null,
  remoteEnabled: true,
  remoteControlInfo: { port: 3900, urls: [] },
  updateConfig: {
    feedUrl: '',
    autoCheck: true,
    effectiveFeedUrl: '',
    isPackaged: false,
    currentVersion: '0.0.0',
    state: null
  },
  plugins: {
    texto: true,
    biblia: true
  }
}

let appPluginManager = null

function createLayer(type, name, extra = {}) {
  const id = state.nextLayerId++
  return {
    id,
    type,
    name: name || `${type.toUpperCase()} ${id}`,
    visible: true,
    opacity: 1,
    src: null,
    url: '',
    text: '',
    sourceIndex: 0,
    frame: null,
    element: null,
    ...extra
  }
}

function initState() {
  const textLayer = createLayer('text', 'Texto Inicial', {
    text: 'MediaLayers pronto para apresentacao',
    opacity: 0.8,
    color: '#1fb6ff',
    font: 'bold 44px Segoe UI'
  })
  state.layers.push(textLayer)
  state.selectedLayerId = textLayer.id
  state.previewLayerId = textLayer.id
}

function getLayerById(layerId) {
  return state.layers.find((l) => l.id === layerId)
}

function getProgramLayers() {
  return state.layers.filter((l) => state.programLayerIds.includes(l.id))
}

function updateToolbarLabel() {
  $('#selected-layer-label').text(`Layer ativo: ${state.selectedLayerId || '-'}`)
}

function copyText(text) {
  if (!text) return

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
    return
  }

  const area = document.createElement('textarea')
  area.value = text
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

function notifyOutputLayers() {
  if (!window.mediaLayers) return

  const programLayers = getProgramLayers().map((layer) => {
    const payload = {
      id: layer.id,
      type: layer.type,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      loop: !!layer.loop,
      volume: typeof layer.volume === 'number' ? layer.volume : 1,
      text: layer.text,
      src: layer.src,
      url: layer.url,
      fontColor: layer.color || '#ffffff',
      fontSize: 52,
      fontBg: 'rgba(0,0,0,0.45)'
    }

    if (layer.type === 'ndi' && layer.frame) {
      payload.frame = layer.frame
    }

    return payload
  })

  window.mediaLayers.sendToOutput({ type: 'update-layers', layers: programLayers })
}

function buildTimelineGrid() {
  const cells = []
  for (let i = 0; i < 16; i += 1) {
    cells.push('<div class="cell"></div>')
  }
  return cells.join('')
}

function createMediaElementForLayer(layer) {
  if (!layer.src) return null

  if (layer.type === 'image') {
    const img = new Image()
    img.src = layer.src
    return img
  }

  if (layer.type === 'video') {
    const video = document.createElement('video')
    video.src = layer.src
    video.autoplay = true
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})
    return video
  }

  return null
}

function ensureLayerMediaElement(layer) {
  if (layer.element) return layer.element
  layer.element = createMediaElementForLayer(layer)
  return layer.element
}

function drawNdiLayer(ctx, layer, canvas) {
  const frame = layer.frame
  if (!frame || !frame.data || !frame.xres || !frame.yres) return

  try {
    const imageData = ctx.createImageData(frame.xres, frame.yres)
    imageData.data.set(new Uint8ClampedArray(frame.data))

    const temp = document.createElement('canvas')
    temp.width = frame.xres
    temp.height = frame.yres
    const tempCtx = temp.getContext('2d')
    tempCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(temp, 0, 0, canvas.width, canvas.height)
  } catch (error) {
    console.warn('[DAW] Falha ao desenhar frame NDI', error)
  }
}

function drawLayer(ctx, layer, canvas) {
  if (!layer.visible) return

  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity))

  if (layer.type === 'ndi') {
    drawNdiLayer(ctx, layer, canvas)
  } else if (layer.type === 'image' || layer.type === 'video') {
    const element = ensureLayerMediaElement(layer)
    if (element && element.readyState !== 0) {
      ctx.drawImage(element, 0, 0, canvas.width, canvas.height)
    }
  } else if (layer.type === 'text') {
    ctx.fillStyle = layer.color || '#ffffff'
    ctx.font = layer.font || 'bold 44px Segoe UI'
    ctx.fillText(layer.text || layer.name, 40, 80)
  } else if (layer.type === 'audio') {
    ctx.fillStyle = '#1f2d45'
    ctx.fillRect(30, 30, canvas.width - 60, 120)
    ctx.fillStyle = '#d0d9e8'
    ctx.font = 'bold 22px Segoe UI'
    ctx.fillText(`Audio: ${layer.name}`, 50, 100)
  } else if (layer.type === 'browser') {
    ctx.fillStyle = '#0f2f46'
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40)
    ctx.fillStyle = '#9fd4ff'
    ctx.font = 'bold 18px Segoe UI'
    ctx.fillText('Browser Source', 40, 60)
    ctx.fillStyle = '#e7eef9'
    ctx.font = '14px monospace'
    ctx.fillText(layer.url || '', 40, 90)
  }

  ctx.globalAlpha = 1
}

function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function renderCanvasForLayerIds(canvasId, layerIds) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  clearCanvas(canvas, ctx)

  layerIds
    .map((id) => getLayerById(id))
    .filter(Boolean)
    .forEach((layer) => drawLayer(ctx, layer, canvas))
}

function renderSwitcherMonitors() {
  const previewId = state.previewLayerId
  const previewLayers = previewId ? [previewId] : []
  renderCanvasForLayerIds('preview-canvas', previewLayers)
  renderCanvasForLayerIds('program-canvas', state.programLayerIds)

  $('#preview-state').text(previewId ? `Preview: layer ${previewId}` : 'Preview: vazio')
  $('#program-state').text(state.programLayerIds.length ? `Program: ${state.programLayerIds.join(', ')}` : 'Program: vazio')
}

function sendCompositeFrameToNdi() {
  if (!window.mediaLayers || !state.ndiOutputActive) return

  const canvas = document.getElementById('program-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  window.mediaLayers.sendNdiOutputFrame({
    width: canvas.width,
    height: canvas.height,
    layerId: state.selectedLayerId || 0,
    data: Array.from(new Uint8Array(img.data.buffer))
  })
}

function startNdiOutputLoop() {
  if (state.ndiOutputInterval) return

  state.ndiOutputInterval = setInterval(() => {
    sendCompositeFrameToNdi()
  }, 1000 / outputConfig.fps)
}

function stopNdiOutputLoop() {
  if (!state.ndiOutputInterval) return
  clearInterval(state.ndiOutputInterval)
  state.ndiOutputInterval = null
}

async function startNdiOutput() {
  if (state.ndiOutputActive || !window.mediaLayers) return

  try {
    await window.mediaLayers.ndiStartSender('MediaLayers Program')
    state.ndiOutputActive = true
    startNdiOutputLoop()
    window.mediaLayers.sendToOutput({ type: 'ndi-output-start' })
    $('#program-state').text('Program: NDI output ativo')
  } catch (error) {
    console.error('[DAW] Falha ao iniciar NDI output', error)
  }
}

async function stopNdiOutput() {
  if (!state.ndiOutputActive || !window.mediaLayers) return

  try {
    await window.mediaLayers.ndiStopSender()
    state.ndiOutputActive = false
    stopNdiOutputLoop()
    window.mediaLayers.sendToOutput({ type: 'ndi-output-stop' })
  } catch (error) {
    console.error('[DAW] Falha ao parar NDI output', error)
  }
}

function addLayer(layer) {
  state.layers.push(layer)
  state.selectedLayerId = layer.id
  state.previewLayerId = layer.id
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
}

function removeLayer(layerId) {
  const index = state.layers.findIndex((l) => l.id === layerId)
  if (index === -1) return

  const layer = state.layers[index]
  if (layer.src && layer.src.startsWith('blob:')) {
    URL.revokeObjectURL(layer.src)
  }

  if (window.mediaLayers && state.ndiActiveReceivers[layerId] !== undefined) {
    window.mediaLayers.ndiStopReceiver(layerId).catch(() => {})
    delete state.ndiActiveReceivers[layerId]
  }

  state.layers.splice(index, 1)
  state.programLayerIds = state.programLayerIds.filter((id) => id !== layerId)

  const fallback = state.layers[0]
  state.selectedLayerId = fallback ? fallback.id : null
  state.previewLayerId = fallback ? fallback.id : null

  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
  notifyOutputLayers()
}

function cueLayer(layerId) {
  state.previewLayerId = layerId
  state.selectedLayerId = layerId
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
}

function takeLayer(layerId) {
  state.programLayerIds = [layerId]
  state.selectedLayerId = layerId
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
  notifyOutputLayers()
}

function toggleLayerOnProgram(layerId) {
  const exists = state.programLayerIds.includes(layerId)
  if (exists) {
    state.programLayerIds = state.programLayerIds.filter((id) => id !== layerId)
  } else {
    state.programLayerIds.push(layerId)
  }
  renderLayerList()
  renderSwitcherMonitors()
  notifyOutputLayers()
}

function renderLayerList() {
  const list = $('#layer-list')
  if (!list.length) return

  list.empty()

  state.layers.forEach((layer) => {
    const inProgram = state.programLayerIds.includes(layer.id)
    const isPreview = state.previewLayerId === layer.id
    const item = $(`
      <li class="layer-item ${layer.id === state.selectedLayerId ? 'selected' : ''}" data-layer-id="${layer.id}">
        <div class="layer-row">
          <strong>${layer.id} - ${layer.name}</strong>
          <span style="font-size:11px;color:#9fb3cc;">${layer.type}</span>
        </div>
        <div class="layer-row" style="margin-top:8px;">
          <span style="font-size:11px;color:#9fb3cc;">${inProgram ? 'ON AIR' : isPreview ? 'PREVIEW' : 'IDLE'}</span>
          <div class="layer-actions">
            <button class="btn small" data-action="cue">Cue</button>
            <button class="btn small" data-action="take">Take</button>
            <button class="btn small" data-action="toggle">Prog</button>
            <button class="btn small" data-action="remove">X</button>
          </div>
        </div>
      </li>
    `)

    item.on('click', (event) => {
      if ($(event.target).is('button')) return
      state.selectedLayerId = layer.id
      renderLayerList()
      renderPropertiesPanel()
      updateToolbarLabel()
    })

    item.find('[data-action="cue"]').on('click', (event) => {
      event.stopPropagation()
      cueLayer(layer.id)
    })

    item.find('[data-action="take"]').on('click', (event) => {
      event.stopPropagation()
      takeLayer(layer.id)
    })

    item.find('[data-action="toggle"]').on('click', (event) => {
      event.stopPropagation()
      toggleLayerOnProgram(layer.id)
    })

    item.find('[data-action="remove"]').on('click', (event) => {
      event.stopPropagation()
      removeLayer(layer.id)
    })

    list.append(item)
  })

  updateToolbarLabel()
}

function renderPropertiesPanel() {
  const panel = $('#properties-panel')
  if (!panel.length) return

  const layer = getLayerById(state.selectedLayerId)
  if (!layer) {
    panel.html('<p>Selecione uma layer.</p>')
    return
  }

  panel.html(`
    <div class="properties-panel">
      <label>Nome</label>
      <input id="prop-name" type="text" value="${escapeHtml(layer.name)}" />

      <label>Visivel</label>
      <select id="prop-visible">
        <option value="true" ${layer.visible ? 'selected' : ''}>Sim</option>
        <option value="false" ${!layer.visible ? 'selected' : ''}>Nao</option>
      </select>

      <label>Opacidade</label>
      <input id="prop-opacity" type="range" min="0" max="1" step="0.05" value="${layer.opacity}" />

      ${layer.type === 'text' ? `
        <label>Texto</label>
        <textarea id="prop-text" rows="4">${escapeHtml(layer.text || '')}</textarea>
      ` : ''}

      ${layer.type === 'browser' ? `
        <label>URL</label>
        <input id="prop-url" type="text" value="${escapeHtml(layer.url || '')}" />
      ` : ''}
    </div>
  `)

  $('#prop-name').on('input', (event) => {
    layer.name = event.target.value
    renderLayerList()
  })

  $('#prop-visible').on('change', (event) => {
    layer.visible = event.target.value === 'true'
    renderLayerList()
    renderSwitcherMonitors()
    notifyOutputLayers()
  })

  $('#prop-opacity').on('input', (event) => {
    layer.opacity = Number(event.target.value)
    renderSwitcherMonitors()
    notifyOutputLayers()
  })

  if (layer.type === 'text') {
    $('#prop-text').on('input', (event) => {
      layer.text = event.target.value
      renderSwitcherMonitors()
      notifyOutputLayers()
    })
  }

  if (layer.type === 'browser') {
    $('#prop-url').on('input', (event) => {
      layer.url = event.target.value
      renderSwitcherMonitors()
      notifyOutputLayers()
    })
  }
}

function fileToLayer(file) {
  const blobUrl = URL.createObjectURL(file)
  if (file.type.startsWith('image/')) {
    return createLayer('image', file.name, { src: blobUrl })
  }

  if (file.type.startsWith('video/')) {
    return createLayer('video', file.name, { src: blobUrl, loop: true })
  }

  if (file.type.startsWith('audio/')) {
    return createLayer('audio', file.name, { src: blobUrl, loop: true, volume: 1 })
  }

  return null
}

function handleDroppedFiles(files) {
  const newLayers = []
  Array.from(files).forEach((file) => {
    const layer = fileToLayer(file)
    if (layer) {
      layer.element = createMediaElementForLayer(layer)
      newLayers.push(layer)
    }
  })

  newLayers.forEach((layer) => addLayer(layer))
  if (newLayers.length) {
    notifyOutputLayers()
  }
}

function registerDragAndDrop() {
  const dropTargets = ['#drop-zone', 'body']

  dropTargets.forEach((selector) => {
    const target = $(selector)
    if (!target.length) return

    target.on('dragover', (event) => {
      event.preventDefault()
      event.stopPropagation()
      $('#drop-zone').addClass('drag-over')
    })

    target.on('dragleave', (event) => {
      event.preventDefault()
      event.stopPropagation()
      $('#drop-zone').removeClass('drag-over')
    })

    target.on('drop', (event) => {
      event.preventDefault()
      event.stopPropagation()
      $('#drop-zone').removeClass('drag-over')
      const dt = event.originalEvent.dataTransfer
      if (dt && dt.files && dt.files.length) {
        handleDroppedFiles(dt.files)
      }
    })
  })
}

async function addNdiInputLayer() {
  if (!window.mediaLayers) return

  try {
    if (!state.ndiAvailable) {
      state.ndiAvailable = await window.mediaLayers.ndiAvailable()
    }

    if (!state.ndiAvailable) {
      alert('NDI nao esta disponivel nesta maquina')
      return
    }

    state.ndiSources = await window.mediaLayers.ndiFindSources()
    if (!state.ndiSources.length) {
      alert('Nenhuma fonte NDI encontrada')
      return
    }

    const sourceNames = state.ndiSources.map((s, i) => `${i}: ${s.name || 'Fonte'}`).join('\n')
    const selected = prompt(`Escolha o indice da fonte NDI:\n${sourceNames}`, '0')
    if (selected === null) return

    const sourceIndex = Number(selected)
    if (Number.isNaN(sourceIndex) || sourceIndex < 0 || sourceIndex >= state.ndiSources.length) {
      alert('Indice invalido')
      return
    }

    const layer = createLayer('ndi', `NDI ${state.ndiSources[sourceIndex].name || sourceIndex}`, {
      sourceIndex
    })

    addLayer(layer)

    await window.mediaLayers.ndiStartReceiver({ layerId: layer.id, sourceIndex })
    state.ndiActiveReceivers[layer.id] = sourceIndex

    if (!state.programLayerIds.length) {
      state.programLayerIds = [layer.id]
    }

    notifyOutputLayers()
  } catch (error) {
    console.error('[DAW] Falha ao adicionar NDI', error)
  }
}

function addTextInputLayer() {
  const layer = createLayer('text', `Texto ${state.nextLayerId}`, {
    text: 'Novo texto',
    color: '#ffffff',
    font: 'bold 44px Segoe UI'
  })
  addLayer(layer)
  notifyOutputLayers()
}

function addBibleLayer() {
  const ref = prompt('Referencia biblica (ex: Joao 3:16)', 'Joao 3:16')
  if (!ref) return
  const verse = prompt('Texto do versiculo', 'Porque Deus amou o mundo...')
  if (!verse) return

  const layer = createLayer('text', `Biblia ${state.nextLayerId}`, {
    text: `${ref} - ${verse}`,
    color: '#f4d35e',
    font: 'bold 38px Segoe UI'
  })

  addLayer(layer)
  notifyOutputLayers()
}

function addBrowserSourceLayer() {
  const url = prompt('URL da Browser Source (https://...)', 'https://example.com')
  if (!url) return
  const layer = createLayer('browser', `Browser ${state.nextLayerId}`, { url })
  addLayer(layer)
  notifyOutputLayers()
}

function addFileFromPicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*,audio/*'
  input.onchange = (event) => {
    const files = event.target.files
    if (files && files.length) {
      handleDroppedFiles(files)
    }
  }
  input.click()
}

function attachToolbarHandlers() {
  $('#save-layout').on('click', () => {
    if (!state.goldenLayout) return
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.goldenLayout.toConfig()))
    } catch (error) {
      console.warn('[DAW] Nao foi possivel salvar layout', error)
    }
  })

  $('#restore-layout').on('click', () => {
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
    location.reload()
  })

  $('#reset-layout').on('click', () => {
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
    location.reload()
  })

  $('#start-ndi-output').on('click', startNdiOutput)
  $('#stop-ndi-output').on('click', stopNdiOutput)
  $('#btn-add-file').on('click', addFileFromPicker)
  $('#btn-add-text').on('click', addTextInputLayer)
  $('#btn-add-ndi').on('click', addNdiInputLayer)
  $('#btn-add-browser').on('click', addBrowserSourceLayer)
  $('#btn-plugin-texto').on('click', () => togglePlugin('texto'))
  $('#btn-plugin-biblia').on('click', () => togglePlugin('biblia'))
  $('#btn-plugin-text-action').on('click', addTextInputLayer)
  $('#btn-plugin-biblia-action').on('click', addBibleLayer)
}

function renderToolbar() {
  $('#golden-layout-toolbar').html(`
    <button id="save-layout" class="toolbar-btn">Salvar Layout</button>
    <button id="restore-layout" class="toolbar-btn">Restaurar</button>
    <button id="reset-layout" class="toolbar-btn danger">Reset</button>
    <button id="btn-add-file" class="toolbar-btn">+ Midia</button>
    <button id="btn-add-text" class="toolbar-btn">+ Texto</button>
    <button id="btn-add-ndi" class="toolbar-btn">+ NDI</button>
    <button id="btn-add-browser" class="toolbar-btn">+ Browser</button>
    <button id="btn-plugin-texto" class="toolbar-btn">Plugin Texto: ON</button>
    <button id="btn-plugin-biblia" class="toolbar-btn">Plugin Biblia: ON</button>
    <button id="btn-plugin-text-action" class="toolbar-btn">Texto Plugin</button>
    <button id="btn-plugin-biblia-action" class="toolbar-btn">Versiculo</button>
    <button id="start-ndi-output" class="toolbar-btn success">Iniciar NDI Output</button>
    <button id="stop-ndi-output" class="toolbar-btn warning">Parar NDI Output</button>
    <span id="selected-layer-label" class="layer-label">Layer ativo: -</span>
  `)

  attachToolbarHandlers()
  refreshPluginButtons()
}

function refreshPluginButtons() {
  $('#btn-plugin-texto').text(`Plugin Texto: ${state.plugins.texto ? 'ON' : 'OFF'}`)
  $('#btn-plugin-biblia').text(`Plugin Biblia: ${state.plugins.biblia ? 'ON' : 'OFF'}`)
  $('#btn-plugin-text-action').prop('disabled', !state.plugins.texto)
  $('#btn-plugin-biblia-action').prop('disabled', !state.plugins.biblia)
}

function renderRemotePanel() {
  const panel = $('#remote-panel')
  if (!panel.length) return

  const urls = state.remoteControlInfo.urls || []
  const links = urls.length
    ? urls.map((item) => `
        <div class="layer-item" style="cursor:default;">
          <div class="layer-row">
            <strong>${escapeHtml(item.label)}</strong>
            <button class="btn small" data-copy-url="${escapeHtml(item.url)}">Copiar</button>
          </div>
          <div style="margin-top:8px;font-size:12px;color:#9fb3cc;word-break:break-all;">${escapeHtml(item.url)}</div>
        </div>
      `).join('')
    : '<p style="margin:0;color:#9fb3cc;font-size:12px;">Aguardando endereco de rede...</p>'

  panel.html(`
    <div class="panel-title">Controle remoto no celular</div>
    <p style="margin:0;color:#9fb3cc;font-size:12px;">Abra um dos links abaixo no celular, na mesma rede do computador.</p>
    <div class="layer-list">${links}</div>
    <div class="clip-editor" style="min-height:auto;">
      <p style="margin:0 0 8px;font-size:12px;color:#9fb3cc;">Comandos disponiveis</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="btn small" style="cursor:default;">Anterior</span>
        <span class="btn small" style="cursor:default;">Proximo</span>
        <span class="btn small" style="cursor:default;">TAKE</span>
        <span class="btn small" style="cursor:default;">CLEAR</span>
      </div>
    </div>
  `)

  panel.find('[data-copy-url]').on('click', (event) => {
    copyText($(event.currentTarget).attr('data-copy-url'))
  })
}

function formatUpdateMessage() {
  const status = state.updateConfig.state
  if (!status) return 'Sem status de atualizacao.'
  return status.message || 'Sem informacoes adicionais.'
}

function renderUpdatesPanel() {
  const panel = $('#updates-panel')
  if (!panel.length) return

  const status = state.updateConfig.state || {}
  const feedUrl = state.updateConfig.feedUrl || ''
  const downloadText = typeof status.downloadProgress === 'number'
    ? `${Math.round(status.downloadProgress)}%`
    : '-'

  panel.html(`
    <div class="panel-title">Atualizacoes</div>
    <div class="properties-panel">
      <label>Versao atual</label>
      <input type="text" value="${escapeHtml(state.updateConfig.currentVersion || '0.0.0')}" disabled />

      <label>URL de updates</label>
      <input id="update-feed-url" type="text" value="${escapeHtml(feedUrl)}" placeholder="https://seu-servidor/medialayers/" />

      <label>Verificar ao iniciar</label>
      <select id="update-auto-check">
        <option value="true" ${state.updateConfig.autoCheck ? 'selected' : ''}>Sim</option>
        <option value="false" ${!state.updateConfig.autoCheck ? 'selected' : ''}>Nao</option>
      </select>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="save-update-config" class="btn">Salvar</button>
        <button id="check-updates-now" class="btn">Verificar agora</button>
        <button id="install-update-now" class="btn">Instalar update</button>
      </div>

      <div class="clip-editor" style="min-height:auto;margin-top:10px;">
        <p style="margin:0 0 6px;font-size:12px;color:#9fb3cc;">Status</p>
        <p style="margin:0 0 6px;font-size:12px;color:#e7eef9;">${escapeHtml(formatUpdateMessage())}</p>
        <p style="margin:0;font-size:12px;color:#9fb3cc;">Download: ${downloadText}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#9fb3cc;">Destino: ${escapeHtml(state.updateConfig.effectiveFeedUrl || 'Nao configurado')}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#9fb3cc;">Modo: ${state.updateConfig.isPackaged ? 'Release empacotada' : 'Desenvolvimento'}</p>
      </div>
    </div>
  `)

  $('#save-update-config').on('click', async () => {
    if (!window.mediaLayers?.appUpdateSetConfig) return

    const config = await window.mediaLayers.appUpdateSetConfig({
      feedUrl: $('#update-feed-url').val(),
      autoCheck: $('#update-auto-check').val() === 'true'
    })

    state.updateConfig = config
    renderUpdatesPanel()
  })

  $('#check-updates-now').on('click', async () => {
    if (!window.mediaLayers?.appUpdateCheck) return
    await window.mediaLayers.appUpdateCheck()
  })

  $('#install-update-now').on('click', async () => {
    if (!window.mediaLayers?.appUpdateInstall) return
    await window.mediaLayers.appUpdateInstall()
  })
}

function togglePlugin(pluginKey) {
  state.plugins[pluginKey] = !state.plugins[pluginKey]

  if (appPluginManager) {
    if (state.plugins[pluginKey]) {
      appPluginManager.enable(pluginKey)
    } else {
      appPluginManager.disable(pluginKey)
    }
  }

  refreshPluginButtons()
}

function setupBuiltinPlugins() {
  if (!window.MediaLayersPlugins || !window.MediaLayersPlugins.manager) return

  appPluginManager = window.MediaLayersPlugins.manager

  class TextoPlugin extends window.MediaLayersPlugins.Plugin {
    constructor() {
      super('texto', '1.0.0', 'MediaLayers')
    }
  }

  class BibliaPlugin extends window.MediaLayersPlugins.Plugin {
    constructor() {
      super('biblia', '1.0.0', 'MediaLayers')
    }
  }

  appPluginManager.register(TextoPlugin)
  appPluginManager.register(BibliaPlugin)

  appPluginManager.load('texto')
  appPluginManager.load('biblia')

  if (state.plugins.texto) appPluginManager.enable('texto')
  if (state.plugins.biblia) appPluginManager.enable('biblia')
}

function registerNdiFrameHandler() {
  if (!window.mediaLayers || registerNdiFrameHandler.done) return

  registerNdiFrameHandler.done = true
  window.mediaLayers.onNdiFrame((payload) => {
    if (!payload || typeof payload.layerId === 'undefined' || !payload.frame) return

    const layer = getLayerById(payload.layerId)
    if (!layer) return

    layer.frame = payload.frame
  })
}

function createDefaultLayoutConfig() {
  return {
    settings: { hasHeaders: true, reorderEnabled: true, showPopoutIcon: true, showMaximiseIcon: true },
    dimensions: { borderWidth: 4, minItemHeight: 120, minItemWidth: 220 },
    content: [
      {
        type: 'column',
        content: [
          { type: 'component', componentName: 'timeline', height: 15, title: 'Timeline', isClosable: false },
          {
            type: 'row',
            height: 65,
            content: [
              { type: 'component', componentName: 'inputs', width: 20, title: 'Entradas', isClosable: false },
              {
                type: 'stack',
                width: 50,
                content: [
                  { type: 'component', componentName: 'switcher', title: 'Preview / Program', isClosable: false },
                  { type: 'component', componentName: 'program', title: 'Program Clean', isClosable: false }
                ]
              },
              {
                type: 'stack',
                width: 30,
                content: [
                  { type: 'component', componentName: 'properties', title: 'Propriedades', isClosable: false },
                  { type: 'component', componentName: 'remote', title: 'Controle Remoto', isClosable: false },
                  { type: 'component', componentName: 'updates', title: 'Atualizacoes', isClosable: false }
                ]
              }
            ]
          },
          { type: 'component', componentName: 'clips', height: 20, title: 'Editor de Clipes', isClosable: false }
        ]
      }
    ]
  }
}

function registerGoldenComponents(goldenLayout) {
  goldenLayout.registerComponent('timeline', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Timeline / Grid</div>
        <div class="timeline-grid">${buildTimelineGrid()}</div>
      </div>
    `)
  })

  goldenLayout.registerComponent('inputs', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Entradas</div>
        <div id="drop-zone" class="drop-zone">Arraste e solte arquivos de video, audio ou imagem aqui</div>
        <ul id="layer-list" class="layer-list"></ul>
      </div>
    `)

    registerDragAndDrop()
    renderLayerList()
  })

  goldenLayout.registerComponent('switcher', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Mesa de corte</div>
        <div class="switcher-wrap">
          <div class="monitor">
            <div class="monitor-head" id="preview-state">Preview</div>
            <canvas id="preview-canvas" width="1280" height="720"></canvas>
          </div>
          <div class="monitor">
            <div class="monitor-head" id="program-state">Program</div>
            <canvas id="program-canvas" width="1280" height="720"></canvas>
          </div>
        </div>
        <div class="switcher-actions">
          <button id="btn-cut" class="btn">Cut</button>
          <button id="btn-clear-program" class="btn">Clear Program</button>
        </div>
      </div>
    `)

    $('#btn-cut').on('click', () => {
      if (state.previewLayerId) takeLayer(state.previewLayerId)
    })

    $('#btn-clear-program').on('click', () => {
      state.programLayerIds = []
      renderLayerList()
      renderSwitcherMonitors()
      notifyOutputLayers()
    })

    renderSwitcherMonitors()
  })

  goldenLayout.registerComponent('program', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Program Feed</div>
        <p style="font-size:12px;color:#9fb3cc;">A janela de output recebe o mesmo estado de program em tempo real.</p>
      </div>
    `)
  })

  goldenLayout.registerComponent('properties', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Properties Inspector</div>
        <div id="properties-panel" class="properties-panel"></div>
      </div>
    `)

    renderPropertiesPanel()
  })

  goldenLayout.registerComponent('remote', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div id="remote-panel"></div>
      </div>
    `)

    renderRemotePanel()
  })

  goldenLayout.registerComponent('updates', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div id="updates-panel"></div>
      </div>
    `)

    renderUpdatesPanel()
  })

  goldenLayout.registerComponent('clips', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Clip Editor</div>
        <div class="clip-editor">
          <p style="color:#9fb3cc;font-size:12px;">Area de clipes pronta para timeline e automacoes.</p>
        </div>
      </div>
    `)
  })
}

function loadLayoutConfig() {
  const fallback = createDefaultLayoutConfig()
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.content)) return fallback
    return parsed
  } catch {
    return fallback
  }
}

function resetBrokenLayoutStorage() {
  try {
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
  } catch {}
}

function initGoldenLayout() {
  const container = document.getElementById('golden-layout-container')
  if (!container) return

  if (typeof window.GoldenLayout !== 'function') {
    container.innerHTML = '<div class="panel-content"><h2>Erro no Golden Layout</h2><p>Biblioteca nao carregada.</p></div>'
    return
  }

  let layoutConfig = loadLayoutConfig()

  try {
    let goldenLayout
    try {
      goldenLayout = new window.GoldenLayout(layoutConfig, container)
    } catch (initError) {
      // Layout salvo de versão anterior pode quebrar com erros como clearMarks/construtor.
      resetBrokenLayoutStorage()
      layoutConfig = createDefaultLayoutConfig()
      goldenLayout = new window.GoldenLayout(layoutConfig, container)
    }

    state.goldenLayout = goldenLayout

    registerGoldenComponents(goldenLayout)

    goldenLayout.on('stateChanged', () => {
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(goldenLayout.toConfig()))
      } catch {}
    })

    try {
      goldenLayout.init()
    } catch (startError) {
      resetBrokenLayoutStorage()
      container.innerHTML = ''
      const cleanLayout = new window.GoldenLayout(createDefaultLayoutConfig(), container)
      state.goldenLayout = cleanLayout
      registerGoldenComponents(cleanLayout)
      cleanLayout.on('stateChanged', () => {
        try {
          localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(cleanLayout.toConfig()))
        } catch {}
      })
      cleanLayout.init()
    }

    renderToolbar()
  } catch (error) {
    console.error('[DAW] Golden Layout init error', error)
    resetBrokenLayoutStorage()
    container.innerHTML = `
      <div class="panel-content">
        <h2>Erro no Golden Layout</h2>
        <p>${escapeHtml(error.message || 'Erro desconhecido')}</p>
      </div>
    `
  }
}

function startRenderLoop() {
  if (state.renderLoopId) return

  const loop = () => {
    renderSwitcherMonitors()
    state.renderLoopId = requestAnimationFrame(loop)
  }

  state.renderLoopId = requestAnimationFrame(loop)
}

function stopRenderLoop() {
  if (!state.renderLoopId) return
  cancelAnimationFrame(state.renderLoopId)
  state.renderLoopId = null
}

function registerRemoteCommands() {
  if (!window.mediaLayers || !window.mediaLayers.onRemoteCommand) return

  window.mediaLayers.onRemoteCommand((command) => {
    if (!command || !state.remoteEnabled) return

    if (command.type === 'take' && state.previewLayerId) {
      takeLayer(state.previewLayerId)
      return
    }

    if (command.type === 'clear') {
      state.programLayerIds = []
      notifyOutputLayers()
      return
    }

    if (command.type === 'next') {
      if (!state.layers.length) return
      const currentIndex = state.layers.findIndex((l) => l.id === state.previewLayerId)
      const nextIndex = (currentIndex + 1) % state.layers.length
      cueLayer(state.layers[nextIndex].id)
      return
    }

    if (command.type === 'prev') {
      if (!state.layers.length) return
      const currentIndex = state.layers.findIndex((l) => l.id === state.previewLayerId)
      const prevIndex = currentIndex <= 0 ? state.layers.length - 1 : currentIndex - 1
      cueLayer(state.layers[prevIndex].id)
    }
  })
}

async function loadRemoteControlInfo() {
  if (!window.mediaLayers?.getRemoteControlInfo) return

  try {
    state.remoteControlInfo = await window.mediaLayers.getRemoteControlInfo()
    renderRemotePanel()
  } catch (error) {
    console.warn('[DAW] Falha ao obter info de controle remoto', error)
  }

  if (window.mediaLayers.onRemoteControlInfo) {
    window.mediaLayers.onRemoteControlInfo((info) => {
      state.remoteControlInfo = info
      renderRemotePanel()
    })
  }
}

async function loadUpdateConfig() {
  if (!window.mediaLayers?.appUpdateGetConfig) return

  try {
    state.updateConfig = await window.mediaLayers.appUpdateGetConfig()
    renderUpdatesPanel()
  } catch (error) {
    console.warn('[DAW] Falha ao obter configuracao de update', error)
  }

  if (window.mediaLayers.onAppUpdateStatus) {
    window.mediaLayers.onAppUpdateStatus((status) => {
      state.updateConfig = {
        ...state.updateConfig,
        state: status,
        currentVersion: status.currentVersion || state.updateConfig.currentVersion,
        effectiveFeedUrl: status.feedUrl || state.updateConfig.effectiveFeedUrl,
        isPackaged: typeof status.isPackaged === 'boolean' ? status.isPackaged : state.updateConfig.isPackaged
      }
      renderUpdatesPanel()
    })
  }
}

function exposeLegacyGlobals() {
  window.layers = state.layers
  window.createLayer = createLayer
  window.renderLayers = renderLayerList
  window.updatePreview = renderSwitcherMonitors
  window.sendToOutput = notifyOutputLayers
}

function escapeHtml(value) {
  if (typeof value !== 'string') return value
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

document.addEventListener('DOMContentLoaded', async () => {
  initState()
  setupBuiltinPlugins()
  exposeLegacyGlobals()
  registerNdiFrameHandler()
  registerRemoteCommands()
  await loadRemoteControlInfo()
  await loadUpdateConfig()
  initGoldenLayout()
  startRenderLoop()

  if (window.mediaLayers) {
    try {
      state.ndiAvailable = await window.mediaLayers.ndiAvailable()
    } catch {
      state.ndiAvailable = false
    }
  }

  notifyOutputLayers()
})

window.addEventListener('beforeunload', async () => {
  stopRenderLoop()
  stopNdiOutputLoop()

  if (window.mediaLayers) {
    const ids = Object.keys(state.ndiActiveReceivers)
    for (const layerId of ids) {
      try {
        await window.mediaLayers.ndiStopReceiver(Number(layerId))
      } catch {}
    }
  }
})
