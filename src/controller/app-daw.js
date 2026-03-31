// ════════════════════════════════════════════════════════════════
// app-daw.js
// MediaLayers Fase 8 - Mixer de Camadas + Composição final NDI
// ════════════════════════════════════════════════════════════════

console.log('🎬 app-daw.js loaded successfully!')

if (typeof window !== 'undefined' && typeof window.jQuery !== 'undefined') {
  window.$ = window.jQuery
  console.log('✅ jQuery is available and exposed as $')
} else {
  console.warn('⚠️ jQuery is not loaded or not exposed yet')
}

let goldenLayout
let ndiState = {
  available: false,
  sources: [],
  activeReceivers: {},
  latestFrames: {},
  frameCounter: 0
}

const outputConfig = {
  width: 1280,
  height: 720,
  fps: 15
}

const controls = {
  ndiOutputActive: false,
  ndiOutputInterval: null,
  selectedLayerId: 1,
  renderLoopId: null
}

const layers = [
  {
    id: 1,
    name: 'NDI Receiver 1',
    type: 'ndi',
    visible: true,
    opacity: 1.0,
    x: 0,
    y: 0,
    width: outputConfig.width,
    height: outputConfig.height,
    sourceIndex: 0,
    frame: null
  },
  {
    id: 2,
    name: 'Texto estático',
    type: 'text',
    text: 'MediaLayers - Fase 8',
    visible: true,
    opacity: 0.7,
    x: 30,
    y: 80,
    width: 700,
    height: 120,
    font: 'bold 44px Segoe UI',
    color: '#19d5ff'
  }
]

function getLayerById(layerId) {
  return layers.find(l => l.id === layerId)
}

function setSelectedLayer(layerId) {
  controls.selectedLayerId = layerId
  $('#layer-list .layer-item').removeClass('selected')
  $(`#layer-list .layer-item[data-layer-id='${layerId}']`).addClass('selected')
  $('#selected-layer-label').text(`Camada ativa: ${layerId}`)
  renderCompositeCanvas()
}

function updateLayerList() {
  const list = $('#layer-list')
  if (!list.length) return

  list.empty()
  layers.forEach(layer => {
    const item = $(
      `<li class='layer-item ${layer.id === controls.selectedLayerId ? 'selected' : ''}' data-layer-id='${layer.id}'>
        <div class='layer-title'>${layer.id} - ${layer.name}</div>
        <div class='layer-actions'>
          <button class='btn small' data-action='attach'>Attach</button>
          <button class='btn small' data-action='toggle'>${layer.visible ? 'Ocultar' : 'Exibir'}</button>
        </div>
      </li>`
    )

    item.find('[data-action="attach"]').on('click', async (e) => {
      e.stopPropagation()
      setSelectedLayer(layer.id)
      if (layer.type !== 'ndi') return
      if (!window.mediaLayers) return

      const sources = await window.mediaLayers.ndiFindSources()
      if (!sources || sources.length === 0) {
        alert('Nenhuma fonte NDI disponível')
        return
      }

      layer.sourceIndex = 0
      await window.mediaLayers.ndiStartReceiver({ layerId: layer.id, sourceIndex: 0 })
      ndiState.activeReceivers[layer.id] = 0
      $('#ndi-preview-status').text(`NDI: layer ${layer.id} recebendo ${sources[0]?.name || 'Fonte 0'}`).css('color', '#7fba00')
    })

    item.find('[data-action="toggle"]').on('click', (e) => {
      e.stopPropagation()
      layer.visible = !layer.visible
      updateLayerList()
      renderCompositeCanvas()
    })

    item.on('click', () => setSelectedLayer(layer.id))

    list.append(item)
  })
}

function registerNdiFrameHandler() {
  if (!window.mediaLayers || registerNdiFrameHandler.attached) return
  registerNdiFrameHandler.attached = true

  window.mediaLayers.onNdiFrame((payload) => {
    if (!payload || typeof payload.layerId === 'undefined' || !payload.frame) return

    const layer = getLayerById(payload.layerId)
    if (!layer) return

    layer.frame = payload.frame
    ndiState.frameCounter += 1

    $('#ndi-preview-status').text(`NDI: recebendo layer ${payload.layerId}`).css('color', '#7fba00')
    $('#ndi-preview-info').text(`frame ${ndiState.frameCounter} - ${payload.frame.xres}x${payload.frame.yres}`)

    renderCompositeCanvas()
  })
}

function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawLayerOnCanvas(ctx, layer, canvasWidth, canvasHeight) {
  if (!layer.visible) return

  ctx.globalAlpha = layer.opacity

  if (layer.type === 'ndi' && layer.frame) {
    const f = layer.frame
    const hasRGBA = f.data && f.data.length >= f.xres * f.yres * 4

    if (hasRGBA) {
      try {
        const imageData = ctx.createImageData(f.xres, f.yres)
        if (Array.isArray(f.data)) {
          imageData.data.set(new Uint8ClampedArray(f.data))
        } else if (f.data instanceof Uint8Array || ArrayBuffer.isView(f.data)) {
          imageData.data.set(new Uint8ClampedArray(f.data))
        }
        const tmp = document.createElement('canvas')
        tmp.width = f.xres
        tmp.height = f.yres
        const tmpCtx = tmp.getContext('2d')
        tmpCtx.putImageData(imageData, 0, 0)
        ctx.drawImage(tmp, 0, 0, canvasWidth, canvasHeight)
      } catch (error) {
        console.warn('[NDI] Erro ao desenhar frame NDI:', error)
      }
    } else {
      ctx.fillStyle = 'rgba(20, 120, 220, 0.24)'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      ctx.fillStyle = '#fff'
      ctx.font = '20px monospace'
      ctx.fillText(`NDI layer ${layer.id} (${f.xres}x${f.yres})`, 20, 40)
    }
  }

  if (layer.type === 'text') {
    ctx.fillStyle = layer.color || '#ffffff'
    ctx.font = layer.font || '40px Arial'
    ctx.fillText(layer.text || layer.name, layer.x, layer.y)
  }

  ctx.globalAlpha = 1.0
}

function renderCompositeCanvas() {
  const canvas = document.getElementById('ndi-preview-canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  clearCanvas(canvas, ctx)

  layers.forEach(layer => {
    drawLayerOnCanvas(ctx, layer, width, height)
  })

  $('#ndi-preview-info').text(`Composição: ${layers.filter(l => l.visible).length} camadas ativas`)
}

function startRenderLoop() {
  const frame = () => {
    renderCompositeCanvas()
    controls.renderLoopId = requestAnimationFrame(frame)
  }
  if (!controls.renderLoopId) frame()
}

function stopRenderLoop() {
  if (!controls.renderLoopId) return
  cancelAnimationFrame(controls.renderLoopId)
  controls.renderLoopId = null
}

function captureAndSendOutputFrame() {
  if (!window.mediaLayers) return

  const canvas = document.getElementById('ndi-preview-canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const bytes = new Uint8Array(imageData.data.buffer)

  window.mediaLayers.sendNdiOutputFrame({
    width: canvas.width,
    height: canvas.height,
    layerId: controls.selectedLayerId,
    data: Array.from(bytes)
  })
}

function startNdiOutputLoop() {
  if (controls.ndiOutputInterval) return
  controls.ndiOutputInterval = setInterval(() => {
    captureAndSendOutputFrame()
  }, 1000 / outputConfig.fps)
  console.log(`▶️ NDI output loop started at ${outputConfig.fps} FPS`)
}

function stopNdiOutputLoop() {
  if (!controls.ndiOutputInterval) return
  clearInterval(controls.ndiOutputInterval)
  controls.ndiOutputInterval = null
  console.log('⏹️ NDI output loop stopped')
}

async function startNdiOutput() {
  if (controls.ndiOutputActive) return
  if (!window.mediaLayers) return

  try {
    await window.mediaLayers.ndiStartSender('MediaLayers Output')
    window.mediaLayers.sendToOutput({ type: 'ndi-output-start' })
    controls.ndiOutputActive = true
    startNdiOutputLoop()
    $('#ndi-preview-status').text('NDI: saída ativa').css('color', '#7fba00')
    console.log('▶️ NDI output started')
  } catch (e) {
    console.error('❌ Falha ao iniciar NDI output:', e)
    controls.ndiOutputActive = false
  }
}

async function stopNdiOutput() {
  if (!controls.ndiOutputActive) return
  if (!window.mediaLayers) return

  try {
    await window.mediaLayers.ndiStopSender()
    window.mediaLayers.sendToOutput({ type: 'ndi-output-stop' })
    controls.ndiOutputActive = false
    stopNdiOutputLoop()
    $('#ndi-preview-status').text('NDI: saída parada').css('color', '#ff8c00')
    console.log('⏹️ NDI output stopped')
  } catch (e) {
    console.error('❌ Falha ao parar NDI output:', e)
  }
}

async function initNdiLayer(layerId) {
  if (!window.mediaLayers) return

  try {
    ndiState.available = await window.mediaLayers.ndiAvailable()
    if (!ndiState.available) {
      $('#ndi-preview-status').text('NDI: indisponível').css('color', '#ff5555')
      return
    }

    ndiState.sources = await window.mediaLayers.ndiFindSources()
    const status = ndiState.sources.length ? `NDI: ${ndiState.sources.length} fontes` : 'NDI: nenhuma fonte'
    $('#ndi-preview-status').text(status)

    if (ndiState.sources.length > 0) {
      const sourceIndex = 0
      await window.mediaLayers.ndiStartReceiver({ layerId, sourceIndex })
      ndiState.activeReceivers[layerId] = sourceIndex
      const layer = getLayerById(layerId)
      if (layer) layer.sourceIndex = sourceIndex

      registerNdiFrameHandler()
    }
  } catch (error) {
    console.error('❌ Erro NDI:', error)
    $('#ndi-preview-status').text('NDI: erro').css('color', '#ff5555')
  }
}

function initGoldenLayout() {
  console.log('🚀 initGoldenLayout called')

  const container = document.getElementById('golden-layout-container')
  if (!container) {
    console.error('❌ Container #golden-layout-container not found!')
    return
  }

  try {
    const defaultConfig = {
      content: [{
        type: 'row',
        content: [
          { type: 'component', componentName: 'layerList', width: 25, title: 'Camadas', isClosable: false },
          { type: 'column', content: [
              { type: 'component', componentName: 'preview', height: 65, title: 'Preview', isClosable: false },
              { type: 'component', componentName: 'properties', height: 35, title: 'Propriedades', isClosable: false }
            ]
          }
        ]
      }]
    }

    const savedLayout = localStorage.getItem('medialayers-golden-layout')
    const layoutConfig = savedLayout ? JSON.parse(savedLayout) : defaultConfig

    goldenLayout = new GoldenLayout(layoutConfig, container)

    goldenLayout.on('stateChanged', () => {
      try {
        localStorage.setItem('medialayers-golden-layout', JSON.stringify(goldenLayout.toConfig()))
      } catch (e) {
        console.warn('Não foi possível salvar layout', e)
      }
    })

    goldenLayout.registerComponent('layerList', (container, state) => {
      container.getElement().html(`
        <div class="panel-content">
          <div class="panel-header">Camadas de Mídia</div>
          <ul id="layer-list" class="layer-list"></ul>
          <button id="add-layer" class="btn">+ Adicionar Camada</button>
        </div>
      `)

      $('#add-layer').on('click', () => {
        const nextId = layers.length + 1
        layers.push({
          id: nextId,
          name: `Camada ${nextId}`,
          type: 'text',
          text: `Camada ${nextId}`,
          visible: true,
          opacity: 0.7,
          x: 50,
          y: 100 + 50 * nextId,
          width: 600,
          height: 100
        })
        updateLayerList()
      })

      updateLayerList()
    })

    goldenLayout.registerComponent('preview', (container, state) => {
      container.getElement().html(`
        <div class="panel-content">
          <div class="panel-header">🥽 Saída Composta</div>
          <div class="preview-wrapper">
            <canvas id="ndi-preview-canvas" width="1280" height="720"></canvas>
            <div id="ndi-preview-status" class="status-text">NDI: desconectado</div>
            <div id="ndi-preview-info" class="info-text">Nenhum frame recebido</div>
          </div>
        </div>
      `)

      initNdiLayer(1)
      renderCompositeCanvas()
      startRenderLoop()
    })

    goldenLayout.registerComponent('properties', (container, state) => {
      container.getElement().html(`
        <div class="panel-content">
          <div class="panel-header">⚙️ Propriedades</div>
          <div id="properties-panel" class="properties-panel">Selecione uma camada para editar</div>
        </div>
      `)
    })

    goldenLayout.init()

    $('#golden-layout-toolbar').html(`
      <button id="save-layout" class="toolbar-btn">Salvar Layout</button>
      <button id="restore-layout" class="toolbar-btn">Restaurar Layout</button>
      <button id="reset-layout" class="toolbar-btn danger">Reset Layout</button>
      <button id="start-ndi-output" class="toolbar-btn success">Iniciar NDI Output</button>
      <button id="stop-ndi-output" class="toolbar-btn warning">Parar NDI Output</button>
      <span id="selected-layer-label" class="layer-label">Camada ativa: 1</span>
    `)

    $('#save-layout').on('click', () => {
      try {
        localStorage.setItem('medialayers-golden-layout', JSON.stringify(goldenLayout.toConfig()))
        console.log('💾 Layout salvo')
      } catch (e) {
        console.error('❌ Falha ao salvar layout:', e)
      }
    })

    $('#restore-layout').on('click', () => {
      localStorage.setItem('medialayers-golden-layout', JSON.stringify(defaultConfig))
      location.reload()
    })

    $('#reset-layout').on('click', () => {
      localStorage.removeItem('medialayers-golden-layout')
      location.reload()
    })

    $('#start-ndi-output').on('click', startNdiOutput)
    $('#stop-ndi-output').on('click', stopNdiOutput)

    console.log('✅ Golden Layout initialized successfully!')
  } catch (error) {
    console.error('❌ Error initializing Golden Layout:', error)
    container.innerHTML = `
      <div style="padding: 20px; background: #2d2d2d; color: #ff6b6b; font-family: Arial; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1>❌ Erro no Golden Layout</h1>
        <p>${error.message}</p>
        <p>Verifique o console para mais detalhes.</p>
      </div>
    `
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 DOMContentLoaded fired - initializing DAW interface...')
  setTimeout(initGoldenLayout, 100)
})
