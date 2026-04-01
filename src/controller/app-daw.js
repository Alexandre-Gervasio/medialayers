console.log('[DAW] app-daw loaded')

if (typeof window !== 'undefined' && window.jQuery) {
  window.$ = window.jQuery
}

const outputConfig = {
  width: 1920,
  height: 1080,
  fps: 15
}

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

const LAYOUT_STORAGE_KEY = 'medialayers-golden-layout-v3'
const SESSION_STORAGE_VERSION = 1
const DEFAULT_MIXER_LAYER_COUNT = 3
const DEFAULT_CLIP_COLUMN_COUNT = 8
const SESSION_CACHE_DELAY = 180

const state = {
  goldenLayout: null,
  layers: [],
  nextLayerId: 1,
  mediaLibrary: [],
  nextMediaId: 1,
  mixerLayerIds: [],
  clipColumns: [],
  activeMixerRow: 0,
  activeColumnIndex: 0,
  liveColumnIndex: null,
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
  diagnostics: {
    items: [],
    logPath: '',
    sessionStartedAt: ''
  },
  transform: {
    active: false,
    mode: null,
    layerId: null,
    startPointer: null,
    startBounds: null,
    guides: []
  },
  plugins: {
    texto: true,
    biblia: true
  },
  bible: {
    version: 'NVI',
    results: []
  },
  mediaOverlay: {
    targetRow: 0,
    targetColumn: 0,
    source: 'toolbar'
  },
  session: {
    dirty: false,
    cachedAt: null,
    saveTimer: null
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
    sourcePath: null,
    url: '',
    text: '',
    sourceIndex: 0,
    mediaId: null,
    x: 0,
    y: 0,
    width: null,
    height: null,
    rotation: 0,
    preserveAspect: true,
    frame: null,
    element: null,
    meta: null,
    ...extra
  }
}

function createMixerLayer(rowIndex) {
  return createLayer('empty', `Layer ${rowIndex + 1}`, {
    type: 'layer-master',
    visible: true,
    opacity: 1,
    volume: 1,
    muted: false,
    solo: false,
    meta: { fixedRow: true, rowIndex }
  })
}

function inferMediaKind(mimeType, name = '') {
  const lowerName = String(name || '').toLowerCase()

  if (String(mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) return 'image'
  if (String(mimeType || '').startsWith('video/') || /\.(mp4|mov|mkv|webm|avi)$/i.test(lowerName)) return 'video'
  if (String(mimeType || '').startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac)$/i.test(lowerName)) return 'audio'

  return null
}

function sourcePathToFileUrl(sourcePath) {
  if (!sourcePath) return null
  if (String(sourcePath).startsWith('file://')) return sourcePath

  const normalized = String(sourcePath).replace(/\\/g, '/')
  const prefix = normalized.startsWith('/') ? 'file://' : 'file:///'
  return encodeURI(`${prefix}${normalized}`)
}

function resolveMediaItemRuntimeSrc(item) {
  if (!item) return null
  if (item.sourcePath) return sourcePathToFileUrl(item.sourcePath)
  if (item.runtimeSrc) return item.runtimeSrc
  if (item.src && !String(item.src).startsWith('blob:')) return item.src
  return null
}

function createDefaultClipColumns(columnCount = DEFAULT_CLIP_COLUMN_COUNT, rowCount = DEFAULT_MIXER_LAYER_COUNT) {
  return Array.from({ length: columnCount }, (_, index) => ({
    id: index + 1,
    name: `Col ${index + 1}`,
    clips: Array.from({ length: rowCount }, () => null)
  }))
}

function normalizeClipColumns(clipColumns, rowCount = DEFAULT_MIXER_LAYER_COUNT) {
  const baseColumns = Array.isArray(clipColumns) && clipColumns.length
    ? clipColumns
    : createDefaultClipColumns(DEFAULT_CLIP_COLUMN_COUNT, rowCount)

  return baseColumns.map((column, index) => ({
    id: Number(column?.id || index + 1),
    name: column?.name || `Col ${index + 1}`,
    clips: Array.from({ length: rowCount }, (_, rowIndex) => {
      const clip = Array.isArray(column?.clips) ? column.clips[rowIndex] : null
      return clip && typeof clip === 'object'
        ? { mediaId: Number(clip.mediaId), label: clip.label || null }
        : null
    })
  }))
}

function ensureMixerLayers(rowCount = DEFAULT_MIXER_LAYER_COUNT) {
  const existing = state.layers
    .filter((layer) => layer.meta?.fixedRow)
    .sort((left, right) => Number(left.meta?.rowIndex || 0) - Number(right.meta?.rowIndex || 0))

  state.mixerLayerIds = existing.map((layer) => layer.id)

  while (state.mixerLayerIds.length < rowCount) {
    const rowIndex = state.mixerLayerIds.length
    const layer = createMixerLayer(rowIndex)
    state.layers.push(layer)
    state.mixerLayerIds.push(layer.id)
  }
}

function ensureClipColumns() {
  state.clipColumns = normalizeClipColumns(state.clipColumns, state.mixerLayerIds.length || DEFAULT_MIXER_LAYER_COUNT)
}

function getMixerLayerByRow(rowIndex) {
  const layerId = state.mixerLayerIds[rowIndex]
  return getLayerById(layerId)
}

function getMediaItemById(mediaId) {
  return state.mediaLibrary.find((item) => item.id === Number(mediaId))
}

function sanitizeLayerForSession(layer) {
  const { element, frame, ...serializable } = layer
  return {
    ...serializable,
    src: serializable.sourcePath ? null : (serializable.src && !String(serializable.src).startsWith('blob:') ? serializable.src : null)
  }
}

function sanitizeMediaItemForSession(item) {
  const { runtimeSrc, ...serializable } = item
  return serializable
}

function hydrateLayerFromSession(layerData) {
  return {
    ...layerData,
    src: layerData?.sourcePath ? sourcePathToFileUrl(layerData.sourcePath) : (layerData?.src || null),
    frame: null,
    element: null,
    preserveAspect: layerData?.preserveAspect !== false
  }
}

function hydrateMediaItemFromSession(item) {
  return {
    ...item,
    runtimeSrc: item?.sourcePath ? sourcePathToFileUrl(item.sourcePath) : null
  }
}

function serializeSessionState() {
  return {
    version: SESSION_STORAGE_VERSION,
    nextLayerId: state.nextLayerId,
    nextMediaId: state.nextMediaId,
    layers: state.layers.map(sanitizeLayerForSession),
    mediaLibrary: state.mediaLibrary.map(sanitizeMediaItemForSession),
    mixerLayerIds: [...state.mixerLayerIds],
    clipColumns: normalizeClipColumns(state.clipColumns, state.mixerLayerIds.length || DEFAULT_MIXER_LAYER_COUNT),
    activeMixerRow: state.activeMixerRow,
    activeColumnIndex: state.activeColumnIndex,
    liveColumnIndex: state.liveColumnIndex,
    selectedLayerId: state.selectedLayerId,
    previewLayerId: state.previewLayerId,
    programLayerIds: [...state.programLayerIds],
    plugins: { ...state.plugins },
    updateConfig: { ...state.updateConfig, state: state.updateConfig.state || null },
    bible: { ...state.bible }
  }
}

function scheduleSessionCache() {
  state.session.dirty = true

  if (state.session.saveTimer) {
    clearTimeout(state.session.saveTimer)
  }

  state.session.saveTimer = setTimeout(() => {
    state.session.saveTimer = null
    const snapshot = serializeSessionState()
    state.session.cachedAt = new Date().toISOString()
    if (window.mediaLayers?.sessionCacheState) {
      window.mediaLayers.sessionCacheState(snapshot)
    }
  }, SESSION_CACHE_DELAY)
}

async function persistSessionNow(showToast = true) {
  const snapshot = serializeSessionState()
  if (window.mediaLayers?.sessionCacheState) {
    window.mediaLayers.sessionCacheState(snapshot)
  }
  if (window.mediaLayers?.sessionSaveState) {
    await window.mediaLayers.sessionSaveState(snapshot)
  }
  state.session.dirty = false
  state.session.cachedAt = new Date().toISOString()
  if (showToast) renderToast('Sessão salva')
}

function applySessionSnapshot(snapshot) {
  state.layers = Array.isArray(snapshot?.layers) ? snapshot.layers.map(hydrateLayerFromSession) : []
  state.nextLayerId = Number(snapshot?.nextLayerId || 1)
  state.mediaLibrary = Array.isArray(snapshot?.mediaLibrary) ? snapshot.mediaLibrary.map(hydrateMediaItemFromSession) : []
  state.nextMediaId = Number(snapshot?.nextMediaId || 1)
  state.clipColumns = normalizeClipColumns(snapshot?.clipColumns, DEFAULT_MIXER_LAYER_COUNT)
  state.activeMixerRow = clamp(Number(snapshot?.activeMixerRow || 0), 0, DEFAULT_MIXER_LAYER_COUNT - 1)
  state.activeColumnIndex = Math.max(0, Number(snapshot?.activeColumnIndex || 0))
  state.liveColumnIndex = typeof snapshot?.liveColumnIndex === 'number' ? snapshot.liveColumnIndex : null
  state.selectedLayerId = snapshot?.selectedLayerId || null
  state.previewLayerId = snapshot?.previewLayerId || null
  state.programLayerIds = Array.isArray(snapshot?.programLayerIds) ? snapshot.programLayerIds.map(Number) : []
  state.plugins = { ...state.plugins, ...(snapshot?.plugins || {}) }
  state.bible = { ...state.bible, ...(snapshot?.bible || {}) }

  ensureMixerLayers(DEFAULT_MIXER_LAYER_COUNT)
  ensureClipColumns()

  if (!state.selectedLayerId || !getLayerById(state.selectedLayerId)) {
    state.selectedLayerId = state.mixerLayerIds[0] || null
  }

  if (!state.previewLayerId || !getLayerById(state.previewLayerId)) {
    state.previewLayerId = state.selectedLayerId
  }
}

function initState(snapshot = null) {
  state.layers = []
  state.nextLayerId = 1
  state.mediaLibrary = []
  state.nextMediaId = 1
  state.mixerLayerIds = []
  state.clipColumns = []
  state.programLayerIds = []
  state.liveColumnIndex = null

  if (snapshot) {
    applySessionSnapshot(snapshot)
    return
  }

  ensureMixerLayers(DEFAULT_MIXER_LAYER_COUNT)
  ensureClipColumns()
  state.selectedLayerId = state.mixerLayerIds[0] || null
  state.previewLayerId = state.selectedLayerId
}

function getLayerById(layerId) {
  return state.layers.find((l) => l.id === layerId)
}

function getProgramLayers() {
  return getColumnComposite(state.liveColumnIndex)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getLayerBounds(layer, canvas) {
  const defaultsByType = {
    text: { width: Math.min(canvas.width * 0.78, 980), height: 220 },
    audio: { width: Math.min(canvas.width - 60, 900), height: 120 },
    browser: { width: canvas.width - 40, height: canvas.height - 40 },
    image: { width: canvas.width, height: canvas.height },
    video: { width: canvas.width, height: canvas.height },
    ndi: { width: canvas.width, height: canvas.height }
  }

  const defaults = defaultsByType[layer.type] || { width: canvas.width, height: canvas.height }

  return {
    x: Number(layer.x || 0),
    y: Number(layer.y || 0),
    width: Number(layer.width || defaults.width),
    height: Number(layer.height || defaults.height),
    rotation: Number(layer.rotation || 0),
    preserveAspect: layer.preserveAspect !== false
  }
}

function applySnap(candidates, threshold = 12) {
  for (const candidate of candidates) {
    if (Math.abs(candidate.distance) <= threshold) {
      return {
        value: candidate.snapTo,
        guide: { axis: candidate.axis, value: candidate.guideLine }
      }
    }
  }

  return { value: candidates[0]?.original ?? 0, guide: null }
}

function snapBounds(bounds, canvas) {
  const snappedX = applySnap([
    { axis: 'vertical', original: bounds.x, snapTo: 0, guideLine: 0, distance: bounds.x },
    {
      axis: 'vertical',
      original: bounds.x,
      snapTo: canvas.width / 2 - bounds.width / 2,
      guideLine: canvas.width / 2,
      distance: bounds.x + bounds.width / 2 - canvas.width / 2
    },
    {
      axis: 'vertical',
      original: bounds.x,
      snapTo: canvas.width - bounds.width,
      guideLine: canvas.width,
      distance: bounds.x + bounds.width - canvas.width
    }
  ])

  const snappedY = applySnap([
    { axis: 'horizontal', original: bounds.y, snapTo: 0, guideLine: 0, distance: bounds.y },
    {
      axis: 'horizontal',
      original: bounds.y,
      snapTo: canvas.height / 2 - bounds.height / 2,
      guideLine: canvas.height / 2,
      distance: bounds.y + bounds.height / 2 - canvas.height / 2
    },
    {
      axis: 'horizontal',
      original: bounds.y,
      snapTo: canvas.height - bounds.height,
      guideLine: canvas.height,
      distance: bounds.y + bounds.height - canvas.height
    }
  ])

  return {
    bounds: {
      ...bounds,
      x: snappedX.value,
      y: snappedY.value
    },
    guides: [snappedX.guide, snappedY.guide].filter(Boolean)
  }
}

function getPreviewTransformLayer() {
  return getLayerById(state.previewLayerId)
}

function updateToolbarLabel() {
  const rowLabel = typeof state.activeMixerRow === 'number' ? state.activeMixerRow + 1 : '-'
  $('#selected-layer-label').text(`Layer ativa: ${rowLabel} • seleção ${state.selectedLayerId || '-'}`)
}

function formatOpacity(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

function renderToast(message) {
  const host = $('#app-toast-host')
  if (!host.length) return

  const toast = $(`<div class="app-toast">${escapeHtml(message)}</div>`)
  host.append(toast)
  setTimeout(() => {
    toast.addClass('is-visible')
  }, 10)
  setTimeout(() => {
    toast.removeClass('is-visible')
    setTimeout(() => toast.remove(), 180)
  }, 2600)
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
  renderToast('Link copiado')
}

function reportRendererError(scope, error, extra = {}) {
  if (!window.mediaLayers?.telemetryReportError) return

  const payload = {
    level: 'error',
    scope,
    message: error?.message || String(error),
    stack: error?.stack,
    extra
  }

  window.mediaLayers.telemetryReportError(payload)
}

function getSelectedMasterLayer() {
  return getLayerById(state.selectedLayerId) || getMixerLayerByRow(state.activeMixerRow)
}

function getSoloRowIndexes() {
  return state.layers
    .filter((layer) => layer.meta?.fixedRow && layer.solo)
    .map((layer) => Number(layer.meta?.rowIndex || 0))
}

function createClipPayload(rowIndex, columnIndex) {
  const master = getMixerLayerByRow(rowIndex)
  const clip = getClipAt(rowIndex, columnIndex)
  const mediaItem = clip ? getMediaItemById(clip.mediaId) : null

  if (!master || !mediaItem || !master.visible) return null

  const soloRows = getSoloRowIndexes()
  if (soloRows.length && !soloRows.includes(rowIndex)) return null

  const payload = {
    id: master.id,
    cacheKey: mediaItem.id,
    rowIndex,
    columnIndex,
    type: mediaItem.kind,
    name: mediaItem.name,
    visible: true,
    opacity: Number(master.opacity ?? 1),
    volume: master.muted ? 0 : Number(master.volume ?? 1),
    muted: Boolean(master.muted),
    solo: Boolean(master.solo),
    text: mediaItem.text || '',
    src: resolveMediaItemRuntimeSrc(mediaItem),
    url: mediaItem.url || '',
    sourceIndex: mediaItem.sourceIndex,
    sourceName: mediaItem.sourceName,
    loop: mediaItem.kind === 'video' || mediaItem.kind === 'audio',
    fontColor: mediaItem.color || '#ffffff',
    fontSize: mediaItem.fontSize || 54,
    fontBg: mediaItem.fontBg || 'rgba(0,0,0,0.45)',
    frame: mediaItem.kind === 'ndi' ? master.frame : null,
    x: 0,
    y: 0,
    width: null,
    height: null,
    rotation: 0
  }

  return payload
}

function getColumnComposite(columnIndex) {
  if (typeof columnIndex !== 'number' || columnIndex < 0) return []

  return state.mixerLayerIds
    .map((layerId, rowIndex) => createClipPayload(rowIndex, columnIndex))
    .filter(Boolean)
}

function PreviewScreen() {
  return getColumnComposite(state.activeColumnIndex)
}

function ProgramScreen() {
  return getColumnComposite(state.liveColumnIndex)
}

function getClipGridSummary(columnIndex) {
  const column = state.clipColumns[columnIndex]
  if (!column) return 'Sem coluna selecionada'
  const clipCount = column.clips.filter(Boolean).length
  return `${column.name} • ${clipCount} clip(s)`
}

function notifyOutputLayers() {
  if (!window.mediaLayers) return

  const programLayers = getProgramLayers()

  window.mediaLayers.sendToOutput({ type: 'update-layers', layers: programLayers })
}

function getClipAt(rowIndex, columnIndex) {
  return state.clipColumns[columnIndex]?.clips?.[rowIndex] || null
}

function getClipLabel(clip) {
  if (!clip) return 'Adicionar mídia'
  const mediaItem = getMediaItemById(clip.mediaId)
  return mediaItem?.name || clip.label || 'Mídia indisponível'
}

function getClipTypeLabel(clip) {
  if (!clip) return 'Clique para atribuir'
  const mediaItem = getMediaItemById(clip.mediaId)
  return mediaItem?.kind ? mediaItem.kind.toUpperCase() : 'SEM FONTE'
}

function selectMixerRow(rowIndex) {
  state.activeMixerRow = clamp(Number(rowIndex || 0), 0, Math.max(0, state.mixerLayerIds.length - 1))
  const rowLayer = getMixerLayerByRow(state.activeMixerRow)

  if (rowLayer) {
    state.selectedLayerId = rowLayer.id
    state.previewLayerId = rowLayer.id
  }

  renderLayerList()
  renderPropertiesPanel()
  renderTimelineOverview()
  renderClipLauncher()
  renderSwitcherMonitors()
  scheduleSessionCache()
}

function setActiveClipCell(rowIndex, columnIndex) {
  state.activeMixerRow = clamp(Number(rowIndex || 0), 0, Math.max(0, state.mixerLayerIds.length - 1))
  state.activeColumnIndex = clamp(Number(columnIndex || 0), 0, Math.max(0, state.clipColumns.length - 1))
  const rowLayer = getMixerLayerByRow(state.activeMixerRow)
  if (rowLayer) {
    state.selectedLayerId = rowLayer.id
    state.previewLayerId = rowLayer.id
  }
  renderTimelineOverview()
  renderClipLauncher()
  renderLayerList()
  renderPropertiesPanel()
  scheduleSessionCache()
}

function createMediaItemFromFile(file) {
  const kind = inferMediaKind(file?.type, file?.name)
  if (!kind) return null

  const sourcePath = file.path || null
  return {
    id: state.nextMediaId++,
    kind,
    name: file.name,
    mimeType: file.type || '',
    sourcePath,
    runtimeSrc: sourcePath ? sourcePathToFileUrl(sourcePath) : URL.createObjectURL(file),
    createdAt: new Date().toISOString()
  }
}

function upsertMediaLibraryItem(item) {
  if (!item) return null

  const existing = item.sourcePath
    ? state.mediaLibrary.find((entry) => entry.sourcePath === item.sourcePath)
    : null

  if (existing) return existing

  state.mediaLibrary.push(item)
  return item
}

function importFilesToLibrary(files) {
  const addedItems = []

  Array.from(files || []).forEach((file) => {
    const item = createMediaItemFromFile(file)
    const stored = upsertMediaLibraryItem(item)
    if (stored) addedItems.push(stored)
  })

  if (!addedItems.length) return []

  renderTimelineOverview()
  renderClipLauncher()
  renderLayerList()
  scheduleSessionCache()
  renderToast(`${addedItems.length} mídia(s) adicionada(s) à biblioteca`)
  return addedItems
}

async function stopLayerReceiverIfNeeded(layer) {
  if (!window.mediaLayers || !layer) return
  if (state.ndiActiveReceivers[layer.id] === undefined) return

  try {
    await window.mediaLayers.ndiStopReceiver(layer.id)
  } catch {}

  delete state.ndiActiveReceivers[layer.id]
  layer.frame = null
}

function assignMediaToSlot(mediaId, rowIndex, columnIndex) {
  ensureClipColumns()
  const mediaItem = getMediaItemById(mediaId)
  const column = state.clipColumns[columnIndex]
  if (!mediaItem || !column) return

  column.clips[rowIndex] = {
    mediaId: mediaItem.id,
    label: mediaItem.name
  }

  setActiveClipCell(rowIndex, columnIndex)
  renderTimelineOverview()
  renderClipLauncher()
  scheduleSessionCache()
  renderToast(`${mediaItem.name} atribuída à coluna ${columnIndex + 1}, layer ${rowIndex + 1}`)
}

function clearClipSlot(rowIndex, columnIndex) {
  const column = state.clipColumns[columnIndex]
  if (!column) return

  column.clips[rowIndex] = null
  setActiveClipCell(rowIndex, columnIndex)
  renderTimelineOverview()
  renderClipLauncher()
  scheduleSessionCache()
}

async function launchColumn(columnIndex) {
  const column = state.clipColumns[columnIndex]
  if (!column) return

  for (let rowIndex = 0; rowIndex < state.mixerLayerIds.length; rowIndex += 1) {
    const master = getMixerLayerByRow(rowIndex)
    const clip = getClipAt(rowIndex, columnIndex)
    const mediaItem = clip ? getMediaItemById(clip.mediaId) : null

    if (!master) continue

    if (mediaItem?.kind === 'ndi' && window.mediaLayers?.ndiStartReceiver) {
      try {
        const sources = await window.mediaLayers.ndiFindSources()
        const sourceIndex = sources.findIndex((source, index) => {
          if (mediaItem.sourceName) return source.name === mediaItem.sourceName
          return index === Number(mediaItem.sourceIndex || 0)
        })

        if (sourceIndex >= 0) {
          await window.mediaLayers.ndiStartReceiver({ layerId: master.id, sourceIndex })
          state.ndiActiveReceivers[master.id] = sourceIndex
        }
      } catch (error) {
        console.warn('[DAW] Falha ao iniciar receiver NDI da coluna', error)
      }
    } else {
      await stopLayerReceiverIfNeeded(master)
    }
  }

  state.liveColumnIndex = columnIndex
  state.activeColumnIndex = columnIndex
  const selectedLayer = getMixerLayerByRow(state.activeMixerRow)
  state.selectedLayerId = selectedLayer?.id || state.mixerLayerIds[0] || null
  state.previewLayerId = state.selectedLayerId

  renderTimelineOverview()
  renderClipLauncher()
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
  notifyOutputLayers()
  scheduleSessionCache()
}

function renderTimelineOverview() {
  const host = $('#timeline-panel')
  if (!host.length) return

  const buttons = state.clipColumns.map((column, index) => {
    const hasContent = column.clips.some(Boolean)
    const classes = [
      'column-trigger-btn',
      state.activeColumnIndex === index ? 'is-selected' : '',
      state.liveColumnIndex === index ? 'is-live' : ''
    ].filter(Boolean).join(' ')

    return `
      <button class="${classes}" data-column-trigger="${index}">
        <strong>${escapeHtml(column.name)}</strong>
        <span>${hasContent ? 'Disparar coluna' : 'Sem clips'}</span>
      </button>
    `
  }).join('')

  host.html(`
    <div class="timeline-summary-bar">
      <div>
        <strong>Layer ativa:</strong> ${state.activeMixerRow + 1}
      </div>
      <div>
        <strong>Coluna no ar:</strong> ${state.liveColumnIndex === null ? '-' : state.liveColumnIndex + 1}
      </div>
      <button id="timeline-open-library" class="btn">Biblioteca global</button>
    </div>
    <div class="timeline-columns-strip">${buttons}</div>
  `)

  host.find('[data-column-trigger]').on('click', async (event) => {
    const index = Number($(event.currentTarget).attr('data-column-trigger'))
    await launchColumn(index)
  })

  $('#timeline-open-library').on('click', () => {
    openGlobalMediaOverlay({
      rowIndex: state.activeMixerRow,
      columnIndex: state.activeColumnIndex,
      source: 'timeline'
    })
  })
}

function renderClipLauncher() {
  const host = $('#clips-panel')
  if (!host.length) return

  function LayerControls(rowIndex) {
    const master = getMixerLayerByRow(rowIndex)
    if (!master) return ''

    return `
      <div class="layer-control-stack">
        <div class="layer-control-topline">
          <strong>${escapeHtml(master.name)}</strong>
          <span>${master.solo ? 'SOLO' : master.muted ? 'MUTE' : 'LIVE'}</span>
        </div>
        <label>Opacity ${Math.round((master.opacity ?? 1) * 100)}%</label>
        <input data-layer-opacity="${rowIndex}" type="range" min="0" max="100" step="1" value="${Math.round((master.opacity ?? 1) * 100)}" />
        <label>Volume ${Math.round((master.volume ?? 1) * 100)}%</label>
        <input data-layer-volume="${rowIndex}" type="range" min="0" max="100" step="1" value="${Math.round((master.volume ?? 1) * 100)}" />
        <div class="layer-control-buttons">
          <button class="btn small ${master.muted ? 'danger' : ''}" data-layer-mute="${rowIndex}">${master.muted ? 'Muted' : 'Mute'}</button>
          <button class="btn small ${master.solo ? 'success' : ''}" data-layer-solo="${rowIndex}">${master.solo ? 'Solo ON' : 'Solo'}</button>
        </div>
      </div>
    `
  }

  function ClipGrid() {
    return state.mixerLayerIds.map((layerId, rowIndex) => {
      const rowCells = state.clipColumns.map((column, columnIndex) => {
        const clip = getClipAt(rowIndex, columnIndex)
        const selected = state.activeMixerRow === rowIndex && state.activeColumnIndex === columnIndex
        const live = state.liveColumnIndex === columnIndex
        const active = live && Boolean(clip)

        return `
          <div class="clip-slot ${selected ? 'is-selected' : ''} ${active ? 'is-live' : ''}" data-clip-slot="${rowIndex}:${columnIndex}">
            <strong>${escapeHtml(getClipLabel(clip))}</strong>
            <span>${escapeHtml(getClipTypeLabel(clip))}</span>
            <div class="clip-slot-actions">
              <button class="btn small" data-assign-slot="${rowIndex}:${columnIndex}">Biblioteca</button>
              <button class="btn small" data-clear-slot="${rowIndex}:${columnIndex}" ${clip ? '' : 'disabled'}>Limpar</button>
            </div>
          </div>
        `
      }).join('')

      return `
        <div class="clip-layer-row" data-layer-row="${rowIndex}">
          <div class="clip-layer-label ${state.activeMixerRow === rowIndex ? 'is-selected' : ''}" data-select-row="${rowIndex}">
            ${LayerControls(rowIndex)}
          </div>
          ${rowCells}
        </div>
      `
    }).join('')
  }

  const headerCells = state.clipColumns.map((column, index) => `
    <button class="clip-column-head ${state.activeColumnIndex === index ? 'is-selected' : ''} ${state.liveColumnIndex === index ? 'is-live' : ''}" data-column-head="${index}">
      ${escapeHtml(column.name)}
    </button>
  `).join('')

  host.html(`
    <div class="clip-launcher-shell">
      <div class="clip-launcher-head">
        <div>
          <strong>Clips por coluna</strong>
          <span>Selecione a layer, atribua mídias da biblioteca global e dispare a coluna inteira.</span>
        </div>
        <button id="clips-open-library" class="btn">Inserir mídia</button>
      </div>
      <div class="clip-grid-head">
        <div class="clip-grid-corner">Layer Controls</div>
        ${headerCells}
      </div>
      <div class="clip-grid-body">${ClipGrid()}</div>
    </div>
  `)

  host.find('[data-select-row]').on('click', (event) => {
    selectMixerRow(Number($(event.currentTarget).attr('data-select-row')))
  })

  host.find('[data-column-head]').on('click', async (event) => {
    const columnIndex = Number($(event.currentTarget).attr('data-column-head'))
    await launchColumn(columnIndex)
  })

  host.find('[data-clip-slot]').on('click', (event) => {
    if ($(event.target).is('button')) return
    const [rowIndex, columnIndex] = String($(event.currentTarget).attr('data-clip-slot')).split(':').map(Number)
    setActiveClipCell(rowIndex, columnIndex)
  })

  host.find('[data-assign-slot]').on('click', (event) => {
    event.stopPropagation()
    const [rowIndex, columnIndex] = String($(event.currentTarget).attr('data-assign-slot')).split(':').map(Number)
    openGlobalMediaOverlay({ rowIndex, columnIndex, source: 'clips' })
  })

  host.find('[data-clear-slot]').on('click', (event) => {
    event.stopPropagation()
    const [rowIndex, columnIndex] = String($(event.currentTarget).attr('data-clear-slot')).split(':').map(Number)
    clearClipSlot(rowIndex, columnIndex)
  })

  $('#clips-open-library').on('click', () => {
    openGlobalMediaOverlay({
      rowIndex: state.activeMixerRow,
      columnIndex: state.activeColumnIndex,
      source: 'clips'
    })
  })

  host.find('[data-layer-opacity]').on('input', (event) => {
    const rowIndex = Number($(event.currentTarget).attr('data-layer-opacity'))
    const master = getMixerLayerByRow(rowIndex)
    if (!master) return
    master.opacity = Number(event.target.value) / 100
    renderClipLauncher()
    renderPropertiesPanel()
    renderSwitcherMonitors()
    notifyOutputLayers()
    scheduleSessionCache()
  })

  host.find('[data-layer-volume]').on('input', (event) => {
    const rowIndex = Number($(event.currentTarget).attr('data-layer-volume'))
    const master = getMixerLayerByRow(rowIndex)
    if (!master) return
    master.volume = Number(event.target.value) / 100
    renderClipLauncher()
    renderPropertiesPanel()
    notifyOutputLayers()
    scheduleSessionCache()
  })

  host.find('[data-layer-mute]').on('click', (event) => {
    const rowIndex = Number($(event.currentTarget).attr('data-layer-mute'))
    const master = getMixerLayerByRow(rowIndex)
    if (!master) return
    master.muted = !master.muted
    renderClipLauncher()
    renderPropertiesPanel()
    notifyOutputLayers()
    scheduleSessionCache()
  })

  host.find('[data-layer-solo]').on('click', (event) => {
    const rowIndex = Number($(event.currentTarget).attr('data-layer-solo'))
    const master = getMixerLayerByRow(rowIndex)
    if (!master) return
    master.solo = !master.solo
    renderClipLauncher()
    renderPropertiesPanel()
    renderSwitcherMonitors()
    notifyOutputLayers()
    scheduleSessionCache()
  })
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
    const bounds = getLayerBounds(layer, canvas)
    drawLayerBox(ctx, temp, bounds)
  } catch (error) {
    console.warn('[DAW] Falha ao desenhar frame NDI', error)
  }
}

function drawLayerBox(ctx, source, bounds) {
  ctx.save()
  ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  ctx.rotate((bounds.rotation * Math.PI) / 180)
  ctx.drawImage(source, -bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height)
  ctx.restore()
}

function drawWrappedText(ctx, text, bounds, lineHeight = 52) {
  const maxWidth = Math.max(80, bounds.width - 30)
  const words = String(text || '').split(/\s+/)
  let line = ''
  let cursorY = -bounds.height / 2 + 40

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, -bounds.width / 2 + 15, cursorY)
      line = word
      cursorY += lineHeight
    } else {
      line = testLine
    }
  })

  if (line) {
    ctx.fillText(line, -bounds.width / 2 + 15, cursorY)
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
      const bounds = getLayerBounds(layer, canvas)
      drawLayerBox(ctx, element, bounds)
    }
  } else if (layer.type === 'text') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.save()
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.rotate((bounds.rotation * Math.PI) / 180)
    ctx.fillStyle = layer.color || '#ffffff'
    ctx.font = layer.font || 'bold 44px Segoe UI'
    drawWrappedText(ctx, layer.text || layer.name, bounds, 52)
    ctx.restore()
  } else if (layer.type === 'audio') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.save()
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.rotate((bounds.rotation * Math.PI) / 180)
    ctx.fillStyle = '#1f2d45'
    ctx.fillRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height)
    ctx.fillStyle = '#d0d9e8'
    ctx.font = 'bold 22px Segoe UI'
    ctx.fillText(`Audio: ${layer.name}`, -bounds.width / 2 + 20, 10)
    ctx.restore()
  } else if (layer.type === 'browser') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.save()
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.rotate((bounds.rotation * Math.PI) / 180)
    ctx.fillStyle = '#0f2f46'
    ctx.fillRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height)
    ctx.fillStyle = '#9fd4ff'
    ctx.font = 'bold 18px Segoe UI'
    ctx.fillText('Browser Source', -bounds.width / 2 + 20, -bounds.height / 2 + 30)
    ctx.fillStyle = '#e7eef9'
    ctx.font = '14px monospace'
    drawWrappedText(ctx, layer.url || '', bounds, 20)
    ctx.restore()
  }

  ctx.globalAlpha = 1
}

function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawTransformOverlay(canvasId, layerId) {
  if (canvasId !== 'preview-canvas') return

  const canvas = document.getElementById(canvasId)
  const ctx = canvas?.getContext('2d')
  const layer = getLayerById(layerId)
  if (!canvas || !ctx || !layer) return

  const bounds = getLayerBounds(layer, canvas)
  const angle = (bounds.rotation * Math.PI) / 180
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2

  const corners = [
    { x: -bounds.width / 2, y: -bounds.height / 2 },
    { x: bounds.width / 2, y: -bounds.height / 2 },
    { x: bounds.width / 2, y: bounds.height / 2 },
    { x: -bounds.width / 2, y: bounds.height / 2 }
  ].map((point) => ({
    x: cx + point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: cy + point.x * Math.sin(angle) + point.y * Math.cos(angle)
  }))

  ctx.save()
  ctx.strokeStyle = '#1fb6ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(corners[0].x, corners[0].y)
  corners.slice(1).forEach((corner) => ctx.lineTo(corner.x, corner.y))
  ctx.closePath()
  ctx.stroke()

  corners.forEach((corner) => {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#1fb6ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.rect(corner.x - 5, corner.y - 5, 10, 10)
    ctx.fill()
    ctx.stroke()
  })

  const rotateHandle = { x: cx, y: bounds.y - 28 }
  ctx.beginPath()
  ctx.moveTo(cx, bounds.y)
  ctx.lineTo(rotateHandle.x, rotateHandle.y)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(rotateHandle.x, rotateHandle.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#1fb6ff'
  ctx.fill()

  state.transform.guides.forEach((guide) => {
    ctx.strokeStyle = 'rgba(31, 182, 255, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    if (guide.axis === 'vertical') {
      ctx.moveTo(guide.value, 0)
      ctx.lineTo(guide.value, canvas.height)
    } else {
      ctx.moveTo(0, guide.value)
      ctx.lineTo(canvas.width, guide.value)
    }
    ctx.stroke()
  })
  ctx.restore()
}

function getMediaPreviewCache() {
  if (!state.mediaPreviewCache) state.mediaPreviewCache = {}
  return state.mediaPreviewCache
}

function ensurePreviewMediaElement(layer) {
  const cache = getMediaPreviewCache()
  const cacheKey = `${layer.type}:${layer.cacheKey || layer.id}`
  if (cache[cacheKey]) return cache[cacheKey]

  const element = createMediaElementForLayer(layer)
  cache[cacheKey] = element
  return element
}

function drawCompositeLayer(ctx, layer, canvas) {
  if (!layer?.visible) return

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)))

  if (layer.type === 'image' || layer.type === 'video') {
    const element = ensurePreviewMediaElement(layer)
    if (element && element.readyState !== 0) {
      drawLayerBox(ctx, element, getLayerBounds(layer, canvas))
    }
  } else if (layer.type === 'ndi') {
    drawNdiLayer(ctx, layer, canvas)
  } else if (layer.type === 'text') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.fillStyle = layer.fontColor || '#ffffff'
    ctx.font = 'bold 46px Segoe UI'
    drawWrappedText(ctx, layer.text || layer.name, bounds, 54)
  } else if (layer.type === 'audio') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.fillStyle = '#111f31'
    ctx.fillRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height)
    ctx.fillStyle = '#e7eef9'
    ctx.font = 'bold 26px Segoe UI'
    ctx.fillText(`Audio • ${layer.name}`, -bounds.width / 2 + 20, 0)
    ctx.font = '14px Segoe UI'
    ctx.fillStyle = '#9fb3cc'
    ctx.fillText(`Volume ${Math.round((layer.volume ?? 1) * 100)}% ${layer.muted ? '• Muted' : ''}`, -bounds.width / 2 + 20, 32)
  } else if (layer.type === 'browser') {
    const bounds = getLayerBounds(layer, canvas)
    ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    ctx.fillStyle = '#0f2f46'
    ctx.fillRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height)
    ctx.fillStyle = '#9fd4ff'
    ctx.font = 'bold 20px Segoe UI'
    ctx.fillText('Browser Source', -bounds.width / 2 + 20, -bounds.height / 2 + 30)
    ctx.fillStyle = '#e7eef9'
    ctx.font = '14px monospace'
    drawWrappedText(ctx, layer.url || '', bounds, 20)
  }

  ctx.restore()
  ctx.globalAlpha = 1
}

function renderCanvasForEntries(canvasId, entries) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  clearCanvas(canvas, ctx)

  entries.forEach((layer) => drawCompositeLayer(ctx, layer, canvas))
}

function renderSwitcherMonitors() {
  renderCanvasForEntries('preview-canvas', PreviewScreen())
  renderCanvasForEntries('program-canvas', ProgramScreen())

  $('#preview-state').text(`Preview • ${getClipGridSummary(state.activeColumnIndex)}`)
  $('#program-state').text(state.liveColumnIndex === null ? 'Program • vazio' : `Program • ${getClipGridSummary(state.liveColumnIndex)}`)
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
  scheduleSessionCache()
}

function removeLayer(layerId) {
  const index = state.layers.findIndex((l) => l.id === layerId)
  if (index === -1) return

  const layer = state.layers[index]
  if (layer.meta?.fixedRow) return
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
  scheduleSessionCache()
}

function cueLayer(layerId) {
  state.previewLayerId = layerId
  state.selectedLayerId = layerId
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
  scheduleSessionCache()
}

function takeLayer(layerId) {
  state.programLayerIds = [layerId]
  state.selectedLayerId = layerId
  renderLayerList()
  renderPropertiesPanel()
  renderSwitcherMonitors()
  notifyOutputLayers()
  scheduleSessionCache()
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
  scheduleSessionCache()
}

function renderLayerList() {
  const list = $('#layer-list')
  if (!list.length) return

  if (!state.mediaLibrary.length) {
    list.html('<li class="empty-state compact">Biblioteca global vazia. Use o overlay para importar mídias persistentes.</li>')
    updateToolbarLabel()
    return
  }

  list.html(state.mediaLibrary.map((item) => `
    <li class="layer-item ${getClipAt(state.activeMixerRow, state.activeColumnIndex)?.mediaId === item.id ? 'selected' : ''}" data-library-id="${item.id}">
      <div class="layer-row">
        <strong>${escapeHtml(item.name)}</strong>
        <span style="font-size:11px;color:#9fb3cc;">${escapeHtml(String(item.kind || '').toUpperCase())}</span>
      </div>
      <div class="layer-row" style="margin-top:8px;">
        <span style="font-size:11px;color:#9fb3cc;">Destino: layer ${state.activeMixerRow + 1}, coluna ${state.activeColumnIndex + 1}</span>
        <div class="layer-actions">
          <button class="btn small" data-library-assign="${item.id}">Usar</button>
        </div>
      </div>
    </li>
  `).join(''))

  list.find('[data-library-assign]').on('click', (event) => {
    event.stopPropagation()
    assignMediaToSlot(Number($(event.currentTarget).attr('data-library-assign')), state.activeMixerRow, state.activeColumnIndex)
  })

  updateToolbarLabel()
}

function renderPropertiesPanel() {
  const panel = $('#properties-panel')
  if (!panel.length) return

  const layer = getSelectedMasterLayer()
  if (!layer) {
    panel.html('<p>Selecione uma layer.</p>')
    return
  }

  const selectedClip = getClipAt(state.activeMixerRow, state.activeColumnIndex)
  const selectedMedia = selectedClip ? getMediaItemById(selectedClip.mediaId) : null

  panel.html(`
    <div class="properties-panel">
      <label>Layer master</label>
      <input id="prop-name" type="text" value="${escapeHtml(layer.name)}" />

      <label>Ativa</label>
      <select id="prop-visible">
        <option value="true" ${layer.visible ? 'selected' : ''}>Sim</option>
        <option value="false" ${!layer.visible ? 'selected' : ''}>Nao</option>
      </select>

      <label>Opacidade <span id="prop-opacity-value" class="property-inline-value">${formatOpacity(layer.opacity)}</span></label>
      <input id="prop-opacity" type="range" min="0" max="1" step="0.05" value="${layer.opacity}" />

      <div class="inline-grid double">
        <div>
          <label>Volume</label>
          <input id="prop-volume" type="range" min="0" max="1" step="0.05" value="${Number(layer.volume ?? 1)}" />
        </div>
        <div>
          <label>Mute</label>
          <select id="prop-muted">
            <option value="false" ${!layer.muted ? 'selected' : ''}>Não</option>
            <option value="true" ${layer.muted ? 'selected' : ''}>Sim</option>
          </select>
        </div>
      </div>

      <div class="inline-grid double">
        <div>
          <label>Solo</label>
          <select id="prop-solo">
            <option value="false" ${!layer.solo ? 'selected' : ''}>Não</option>
            <option value="true" ${layer.solo ? 'selected' : ''}>Sim</option>
          </select>
        </div>
        <div>
          <label>Coluna selecionada</label>
          <input type="text" value="${escapeHtml(getClipGridSummary(state.activeColumnIndex))}" disabled />
        </div>
      </div>

      <div class="clip-editor" style="min-height:auto; margin-top: 8px;">
        <p style="margin:0 0 6px; font-size:12px; color:#9fb3cc;">Clip selecionado</p>
        <p style="margin:0; font-size:13px; color:#e7eef9;">${escapeHtml(selectedMedia?.name || 'Nenhum clip selecionado')}</p>
        <p style="margin:6px 0 0; font-size:12px; color:#9fb3cc;">${escapeHtml(selectedMedia?.kind ? String(selectedMedia.kind).toUpperCase() : 'SEM CLIP')}</p>
      </div>
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
    $('#prop-opacity-value').text(formatOpacity(layer.opacity))
    renderSwitcherMonitors()
    notifyOutputLayers()
  })

  $('#prop-volume').on('input', (event) => {
    layer.volume = Number(event.target.value)
    renderClipLauncher()
    notifyOutputLayers()
  })

  $('#prop-muted').on('change', (event) => {
    layer.muted = event.target.value === 'true'
    renderClipLauncher()
    notifyOutputLayers()
  })

  $('#prop-solo').on('change', (event) => {
    layer.solo = event.target.value === 'true'
    renderClipLauncher()
    renderSwitcherMonitors()
    notifyOutputLayers()
  })

  panel.find('input, select, textarea').on('input.session-cache change.session-cache', () => {
    scheduleSessionCache()
  })
}

function handleDroppedFiles(files) {
  importFilesToLibrary(files)
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

    const item = upsertMediaLibraryItem({
      id: state.nextMediaId++,
      kind: 'ndi',
      name: `NDI ${state.ndiSources[sourceIndex].name || sourceIndex}`,
      sourceIndex,
      sourceName: state.ndiSources[sourceIndex].name || '',
      createdAt: new Date().toISOString()
    })

    assignMediaToSlot(item.id, state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
    renderGlobalMediaOverlayLibrary()
    scheduleSessionCache()
    closeGlobalMediaOverlay()
  } catch (error) {
    console.error('[DAW] Falha ao adicionar NDI', error)
  }
}

function addTextInputLayer() {
  const suggestedName = `Texto ${state.nextMediaId}`
  const name = prompt('Nome do clip de texto', suggestedName)
  if (name === null) return

  const text = prompt('Conteúdo do texto', 'Novo texto')
  if (text === null) return

  const item = upsertMediaLibraryItem({
    id: state.nextMediaId++,
    kind: 'text',
    name: name.trim() || suggestedName,
    text,
    color: '#ffffff',
    font: 'bold 44px Segoe UI',
    createdAt: new Date().toISOString()
  })

  assignMediaToSlot(item.id, state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
  renderGlobalMediaOverlayLibrary()
  scheduleSessionCache()
  closeGlobalMediaOverlay()
}

function upsertBibleLayer(verse) {
  if (!verse) return

  const text = `${verse.text}\n\n- ${verse.ref} (${state.bible.version})`
  const item = upsertMediaLibraryItem({
    id: state.nextMediaId++,
    kind: 'text',
    name: `Bíblia ${verse.ref}`,
    text,
    color: '#f4d35e',
    font: 'bold 38px Segoe UI',
    createdAt: new Date().toISOString(),
    meta: { source: 'biblia', ref: verse.ref, version: state.bible.version }
  })

  assignMediaToSlot(item.id, state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
  renderGlobalMediaOverlayLibrary()
  closeBibleModal()
  closeGlobalMediaOverlay()
  scheduleSessionCache()
  renderToast(`Versículo carregado: ${verse.ref}`)
}

function closeBibleModal() {
  $('#bible-modal').remove()
}

function renderBibleResults() {
  const host = $('#bible-results')
  if (!host.length) return

  if (!state.bible.results.length) {
    host.html('<div class="empty-state compact">Nenhum versículo encontrado.</div>')
    return
  }

  host.html(state.bible.results.map((verse, index) => `
    <button class="result-card" data-verse-index="${index}">
      <strong>${escapeHtml(verse.ref)}</strong>
      <span>${escapeHtml(verse.text)}</span>
    </button>
  `).join(''))

  host.find('[data-verse-index]').on('click', (event) => {
    const idx = Number($(event.currentTarget).attr('data-verse-index'))
    const verse = state.bible.results[idx]
    upsertBibleLayer(verse)
  })
}

async function searchBible(mode) {
  if (!window.mediaLayers?.bibliaSearch) return

  try {
    let results = []
    if (mode === 'reference') {
      const book = $('#bible-book').val()
      const chapter = Number($('#bible-chapter').val() || 1)
      const verseStart = Number($('#bible-verse-start').val() || 1)
      const verseEnd = Number($('#bible-verse-end').val() || verseStart)

      results = await window.mediaLayers.bibliaSearch({
        type: 'reference',
        book,
        chapter,
        verseStart,
        verseEnd,
        version: state.bible.version
      })
    } else {
      const query = String($('#bible-query').val() || '').trim()
      if (!query) return

      results = await window.mediaLayers.bibliaSearch({
        type: 'text',
        query,
        version: state.bible.version
      })
    }

    state.bible.results = Array.isArray(results) ? results : []
    renderBibleResults()
  } catch (error) {
    reportRendererError('biblia-search', error, { mode })
    renderToast(`Falha ao buscar versículos: ${error.message}`)
  }
}

function openBibleModal() {
  closeBibleModal()

  $('body').append(`
    <div id="bible-modal" class="modal-shell">
      <div class="modal-card bible-modal-card">
        <div class="modal-head">
          <div>
            <strong>Versículos</strong>
            <p>Busque por referência ou trecho e envie para preview/program.</p>
          </div>
          <button id="bible-close" class="icon-btn" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-grid">
          <div class="modal-section">
            <label>Versão</label>
            <select id="bible-version">
              <option value="NVI" ${state.bible.version === 'NVI' ? 'selected' : ''}>NVI</option>
              <option value="ARA" ${state.bible.version === 'ARA' ? 'selected' : ''}>ARA</option>
              <option value="ACF" ${state.bible.version === 'ACF' ? 'selected' : ''}>ACF</option>
              <option value="NTLH" ${state.bible.version === 'NTLH' ? 'selected' : ''}>NTLH</option>
            </select>
            <label>Livro</label>
            <select id="bible-book">
              ${BIBLE_BOOKS.map((book) => `<option value="${book}">${book}</option>`).join('')}
            </select>
            <div class="inline-grid triple">
              <div>
                <label>Capítulo</label>
                <input id="bible-chapter" type="number" min="1" value="3" />
              </div>
              <div>
                <label>Verso inicial</label>
                <input id="bible-verse-start" type="number" min="1" value="16" />
              </div>
              <div>
                <label>Verso final</label>
                <input id="bible-verse-end" type="number" min="1" value="16" />
              </div>
            </div>
            <button id="bible-search-reference" class="btn">Buscar referência</button>
          </div>
          <div class="modal-section">
            <label>Buscar por texto</label>
            <input id="bible-query" type="text" placeholder="Porque Deus amou o mundo" />
            <button id="bible-search-text" class="btn">Buscar trecho</button>
            <div id="bible-results" class="result-list"></div>
          </div>
        </div>
      </div>
    </div>
  `)

  $('#bible-close').on('click', closeBibleModal)
  $('#bible-version').on('change', (event) => {
    state.bible.version = event.target.value
  })
  $('#bible-search-reference').on('click', () => searchBible('reference'))
  $('#bible-search-text').on('click', () => searchBible('text'))
  $('#bible-query').on('keydown', (event) => {
    if (event.key === 'Enter') searchBible('text')
  })
  renderBibleResults()
}

function addBibleLayer() {
  openBibleModal()
}

function addBrowserSourceLayer() {
  const url = prompt('URL da Browser Source (https://...)', 'https://example.com')
  if (!url) return
  const item = upsertMediaLibraryItem({
    id: state.nextMediaId++,
    kind: 'browser',
    name: `Browser ${state.nextMediaId - 1}`,
    url,
    createdAt: new Date().toISOString()
  })

  assignMediaToSlot(item.id, state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
  renderGlobalMediaOverlayLibrary()
  scheduleSessionCache()
  closeGlobalMediaOverlay()
}

function addFileFromPicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*,video/*,audio/*'
  input.onchange = (event) => {
    const files = event.target.files
    if (files && files.length) {
      importFilesToLibrary(files)
    }
  }
  input.click()
}

function getCanvasPointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  }
}

function isPointInsideLayer(point, bounds) {
  const angle = (-bounds.rotation * Math.PI) / 180
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const dx = point.x - cx
  const dy = point.y - cy
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle)

  return Math.abs(localX) <= bounds.width / 2 && Math.abs(localY) <= bounds.height / 2
}

function getTransformHandle(point, bounds) {
  const handles = {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    rotate: { x: bounds.x + bounds.width / 2, y: bounds.y - 28 }
  }

  for (const [name, handle] of Object.entries(handles)) {
    if (Math.abs(point.x - handle.x) <= 10 && Math.abs(point.y - handle.y) <= 10) {
      return name
    }
  }

  if (isPointInsideLayer(point, bounds)) {
    return 'move'
  }

  return null
}

function applyTransformFromPointer(pointer, canvas) {
  const transform = state.transform
  const layer = getLayerById(transform.layerId)
  if (!layer || !transform.startPointer || !transform.startBounds) return

  const dx = pointer.x - transform.startPointer.x
  const dy = pointer.y - transform.startPointer.y
  const start = { ...transform.startBounds }
  let nextBounds = { ...start }

  if (transform.mode === 'move') {
    nextBounds.x = start.x + dx
    nextBounds.y = start.y + dy
  } else if (transform.mode === 'rotate') {
    const centerX = start.x + start.width / 2
    const centerY = start.y + start.height / 2
    nextBounds.rotation = Math.round((Math.atan2(pointer.y - centerY, pointer.x - centerX) * 180) / Math.PI + 90)
  } else {
    const aspect = start.width / Math.max(1, start.height)
    const signX = transform.mode.includes('w') ? -1 : 1
    const signY = transform.mode.includes('n') ? -1 : 1

    let width = clamp(start.width + dx * signX, 40, canvas.width * 2)
    let height = clamp(start.height + dy * signY, 40, canvas.height * 2)

    if (start.preserveAspect) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        height = width / aspect
      } else {
        width = height * aspect
      }
    }

    nextBounds.width = width
    nextBounds.height = height

    if (transform.mode.includes('w')) {
      nextBounds.x = start.x + (start.width - width)
    }
    if (transform.mode.includes('n')) {
      nextBounds.y = start.y + (start.height - height)
    }
  }

  if (transform.mode !== 'rotate') {
    const snapped = snapBounds(nextBounds, canvas)
    nextBounds = snapped.bounds
    state.transform.guides = snapped.guides
  }

  layer.x = Math.round(nextBounds.x)
  layer.y = Math.round(nextBounds.y)
  layer.width = Math.round(nextBounds.width)
  layer.height = Math.round(nextBounds.height)
  layer.rotation = Math.round(nextBounds.rotation || 0)

  renderPropertiesPanel()
  renderSwitcherMonitors()
  notifyOutputLayers()
}

function registerPreviewInteractions() {
  const canvas = document.getElementById('preview-canvas')
  if (!canvas || canvas.dataset.transformBound === 'true') return

  canvas.dataset.transformBound = 'true'

  canvas.addEventListener('pointerdown', (event) => {
    const layer = getPreviewTransformLayer()
    if (!layer) return

    const pointer = getCanvasPointerPosition(canvas, event)
    const bounds = getLayerBounds(layer, canvas)
    const mode = getTransformHandle(pointer, bounds)
    if (!mode) return

    state.transform.active = true
    state.transform.mode = mode
    state.transform.layerId = layer.id
    state.transform.startPointer = pointer
    state.transform.startBounds = bounds
    state.transform.guides = []
    canvas.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  canvas.addEventListener('pointermove', (event) => {
    const pointer = getCanvasPointerPosition(canvas, event)

    if (!state.transform.active) {
      const layer = getPreviewTransformLayer()
      if (!layer) return
      const bounds = getLayerBounds(layer, canvas)
      const mode = getTransformHandle(pointer, bounds)
      canvas.style.cursor = mode === 'move'
        ? 'move'
        : mode === 'rotate'
          ? 'crosshair'
          : mode
            ? 'nwse-resize'
            : 'default'
      return
    }

    applyTransformFromPointer(pointer, canvas)
  })

  canvas.addEventListener('pointerup', () => {
    state.transform.active = false
    state.transform.mode = null
    state.transform.layerId = null
    state.transform.startPointer = null
    state.transform.startBounds = null
    state.transform.guides = []
    renderSwitcherMonitors()
  })
}

function closeGlobalMediaOverlay() {
  $('#global-media-overlay').remove()
}

function renderGlobalMediaOverlayLibrary() {
  const host = $('#global-media-library-grid')
  if (!host.length) return

  if (!state.mediaLibrary.length) {
    host.html('<div class="empty-state compact">A biblioteca global ainda está vazia. Importe arquivos ou crie uma fonte a partir das ações acima.</div>')
    return
  }

  host.html(state.mediaLibrary.map((item) => `
    <button class="global-media-card" data-library-item="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(String(item.kind || '').toUpperCase())}</span>
      <small>${escapeHtml(item.sourcePath || item.url || item.text || 'Biblioteca global')}</small>
    </button>
  `).join(''))

  host.find('[data-library-item]').on('click', (event) => {
    const mediaId = Number($(event.currentTarget).attr('data-library-item'))
    assignMediaToSlot(mediaId, state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
    closeGlobalMediaOverlay()
  })
}

function openGlobalMediaOverlay(options = {}) {
  state.mediaOverlay.targetRow = clamp(Number(options.rowIndex ?? state.activeMixerRow), 0, Math.max(0, state.mixerLayerIds.length - 1))
  state.mediaOverlay.targetColumn = clamp(Number(options.columnIndex ?? state.activeColumnIndex), 0, Math.max(0, state.clipColumns.length - 1))
  state.mediaOverlay.source = options.source || 'toolbar'

  setActiveClipCell(state.mediaOverlay.targetRow, state.mediaOverlay.targetColumn)
  closeGlobalMediaOverlay()

  $('body').append(`
    <div id="global-media-overlay" class="global-media-overlay" role="dialog" aria-modal="true">
      <div class="global-media-panel">
        <div class="global-media-head">
          <div>
            <strong>Biblioteca global de mídias</strong>
            <p>Overlay único para importar, reutilizar e atribuir clips às colunas. Destino atual: layer ${state.mediaOverlay.targetRow + 1}, coluna ${state.mediaOverlay.targetColumn + 1}.</p>
          </div>
          <button id="global-media-close" class="icon-btn" aria-label="Fechar">✕</button>
        </div>
        <div class="global-media-layout">
          <aside class="global-media-sidebar">
            <button class="quick-media-card" data-overlay-action="file">
              <strong>Importar arquivos</strong>
              <span>Imagem, vídeo ou áudio entram na biblioteca persistente.</span>
            </button>
            <button class="quick-media-card" data-overlay-action="text">
              <strong>Texto</strong>
              <span>Cria um clip de texto reutilizável para a célula selecionada.</span>
            </button>
            <button class="quick-media-card" data-overlay-action="bible">
              <strong>Versículo</strong>
              <span>Busca um versículo e adiciona como clip reutilizável.</span>
            </button>
            <button class="quick-media-card" data-overlay-action="ndi">
              <strong>Entrada NDI</strong>
              <span>Salva uma fonte NDI na biblioteca para disparo por coluna.</span>
            </button>
            <button class="quick-media-card" data-overlay-action="browser">
              <strong>Browser Source</strong>
              <span>Adiciona uma URL persistente à biblioteca global.</span>
            </button>
          </aside>
          <section class="global-media-content">
            <div class="global-media-content-head">
              <strong>Lista única de mídias</strong>
              <span>${state.mediaLibrary.length} item(ns) disponível(is)</span>
            </div>
            <div id="global-media-library-grid" class="global-media-library-grid"></div>
          </section>
        </div>
      </div>
    </div>
  `)

  $('#global-media-close').on('click', closeGlobalMediaOverlay)
  $('#global-media-overlay').on('click', (event) => {
    if (event.target.id === 'global-media-overlay') {
      closeGlobalMediaOverlay()
    }
  })

  $('[data-overlay-action]').on('click', async (event) => {
    const action = $(event.currentTarget).attr('data-overlay-action')

    if (action === 'file') addFileFromPicker()
    if (action === 'text') addTextInputLayer()
    if (action === 'bible') {
      closeGlobalMediaOverlay()
      addBibleLayer()
    }
    if (action === 'ndi') await addNdiInputLayer()
    if (action === 'browser') addBrowserSourceLayer()
  })

  renderGlobalMediaOverlayLibrary()
}

function closeMediaModal() {
  closeGlobalMediaOverlay()
}

function openMediaAddModal() {
  openGlobalMediaOverlay({
    rowIndex: state.activeMixerRow,
    columnIndex: state.activeColumnIndex,
    source: 'toolbar'
  })
}

function closeToolbarMenus() {
  $('.toolbar-menu').removeClass('is-open')
}

function bindToolbarMenuToggle(toggleSelector, menuSelector) {
  $(toggleSelector).on('click', (event) => {
    event.stopPropagation()
    const menu = $(menuSelector)
    const shouldOpen = !menu.hasClass('is-open')
    closeToolbarMenus()
    menu.toggleClass('is-open', shouldOpen)
  })
}

function attachToolbarHandlers() {
  $(document).off('click.toolbar-menu')

  $('#save-layout').on('click', () => {
    if (state.goldenLayout) {
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.goldenLayout.toConfig()))
      } catch (error) {
        console.warn('[DAW] Nao foi possivel salvar layout', error)
      }
    }

    persistSessionNow().catch((error) => {
      console.warn('[DAW] Nao foi possivel salvar sessao', error)
    })
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
  $('#open-media-modal').on('click', () => {
    openMediaAddModal()
    closeToolbarMenus()
  })
  $('#btn-plugin-texto').on('click', () => togglePlugin('texto'))
  $('#btn-plugin-biblia').on('click', () => togglePlugin('biblia'))
  $('#btn-refresh-diagnostics').on('click', loadTelemetryState)

  bindToolbarMenuToggle('#plugin-menu-toggle', '#plugin-menu')

  $(document).on('click.toolbar-menu', () => closeToolbarMenus())
}

function renderToolbar() {
  $('#golden-layout-toolbar').html(`
    <div class="toolbar-group brand-group">
      <div class="brand-mark">ML</div>
      <div>
        <strong class="brand-title">MediaLayers</strong>
        <span class="brand-subtitle">Switcher em tempo real</span>
      </div>
    </div>
    <div class="toolbar-group">
      <button id="save-layout" class="toolbar-btn">Salvar sessão</button>
      <button id="restore-layout" class="toolbar-btn">Restaurar</button>
      <button id="reset-layout" class="toolbar-btn danger">Reset</button>
    </div>
    <div class="toolbar-group">
      <button id="open-media-modal" class="toolbar-btn">Adicionar mídia</button>
    </div>
    <div class="toolbar-group toolbar-menu-group">
      <button id="plugin-menu-toggle" class="toolbar-btn">Plugins ▾</button>
      <div id="plugin-menu" class="toolbar-menu">
        <button id="btn-plugin-texto" class="toolbar-menu-item">Plugin Texto: ON</button>
        <button id="btn-plugin-biblia" class="toolbar-menu-item">Plugin Bíblia: ON</button>
        <button id="btn-refresh-diagnostics" class="toolbar-menu-item">Atualizar diagnóstico</button>
      </div>
    </div>
    <div class="toolbar-group">
      <button id="start-ndi-output" class="toolbar-btn success">NDI On</button>
      <button id="stop-ndi-output" class="toolbar-btn warning">NDI Off</button>
    </div>
    <span id="selected-layer-label" class="layer-label">Layer ativo: -</span>
    <div id="app-toast-host" class="app-toast-host"></div>
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
  const canInstall = Boolean(status.downloaded)
  const isChecking = Boolean(status.checking)

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
        <button id="check-updates-now" class="btn" ${isChecking ? 'disabled' : ''}>${isChecking ? 'Verificando...' : 'Verificar agora'}</button>
        <button id="install-update-now" class="btn" ${canInstall ? '' : 'disabled'}>Instalar update</button>
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

function renderDiagnosticsPanel() {
  const panel = $('#diagnostics-panel')
  if (!panel.length) return

  const items = state.diagnostics.items || []
  const content = items.length
    ? items.slice(0, 12).map((item) => `
        <div class="diagnostic-item diagnostic-${escapeHtml(item.level || 'info')}">
          <div class="diagnostic-meta">
            <strong>${escapeHtml(item.scope || 'app')}</strong>
            <span>${escapeHtml(item.timestamp || '')}</span>
          </div>
          <div class="diagnostic-message">${escapeHtml(item.message || '')}</div>
        </div>
      `).join('')
    : '<div class="empty-state compact">Nenhum erro capturado nesta sessão.</div>'

  panel.html(`
    <div class="panel-title">Diagnóstico e telemetria</div>
    <div class="diagnostic-summary">
      <span>Erros recentes: ${items.length}</span>
      <span>Log: ${escapeHtml(state.diagnostics.logPath || 'indisponível')}</span>
    </div>
    <div class="diagnostic-list">${content}</div>
  `)
}

async function loadTelemetryState() {
  if (!window.mediaLayers?.telemetryGetState) return

  try {
    state.diagnostics = await window.mediaLayers.telemetryGetState()
    renderDiagnosticsPanel()
  } catch (error) {
    reportRendererError('telemetry-load', error)
  }

  if (window.mediaLayers.onTelemetryUpdated && !loadTelemetryState.bound) {
    loadTelemetryState.bound = true
    window.mediaLayers.onTelemetryUpdated((snapshot) => {
      state.diagnostics = snapshot
      renderDiagnosticsPanel()
    })
  }
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
                  { type: 'component', componentName: 'updates', title: 'Atualizacoes', isClosable: false },
                  { type: 'component', componentName: 'diagnostics', title: 'Diagnóstico', isClosable: false }
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
        <div class="panel-title">Colunas</div>
        <div id="timeline-panel" class="timeline-panel"></div>
      </div>
    `)

    renderTimelineOverview()
  })

  goldenLayout.registerComponent('inputs', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Biblioteca Global</div>
        <div id="drop-zone" class="drop-zone">Arraste arquivos aqui para alimentar a biblioteca global persistente</div>
        <ul id="layer-list" class="layer-list"></ul>
      </div>
    `)

    registerDragAndDrop()
    renderLayerList()
  })

  goldenLayout.registerComponent('switcher', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Preview / Program 1920x1080</div>
        <div class="switcher-wrap">
          <div class="monitor">
            <div class="monitor-head" id="preview-state">Preview</div>
            <div class="monitor-stage"><canvas id="preview-canvas" width="1920" height="1080"></canvas></div>
          </div>
          <div class="monitor">
            <div class="monitor-head" id="program-state">Program</div>
            <div class="monitor-stage"><canvas id="program-canvas" width="1920" height="1080"></canvas></div>
          </div>
        </div>
        <div class="switcher-actions">
          <button id="btn-cut" class="btn">Disparar coluna selecionada</button>
          <button id="btn-clear-program" class="btn">Clear Program</button>
        </div>
      </div>
    `)

    $('#btn-cut').on('click', () => {
      launchColumn(state.activeColumnIndex).catch((error) => {
        console.error('[DAW] Falha ao disparar coluna', error)
      })
    })

    $('#btn-clear-program').on('click', () => {
      state.liveColumnIndex = null
      renderClipLauncher()
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

  goldenLayout.registerComponent('diagnostics', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div id="diagnostics-panel"></div>
      </div>
    `)

    renderDiagnosticsPanel()
  })

  goldenLayout.registerComponent('clips', function(container) {
    container.getElement().html(`
      <div class="panel-content">
        <div class="panel-title">Clips / Layers</div>
        <div id="clips-panel" class="clip-editor clip-launcher-panel"></div>
      </div>
    `)

    renderClipLauncher()
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

    if (command.type === 'take') {
      launchColumn(state.activeColumnIndex).catch((error) => {
        console.error('[DAW] Falha ao disparar coluna via controle remoto', error)
      })
      return
    }

    if (command.type === 'clear') {
      state.liveColumnIndex = null
      renderTimelineOverview()
      renderClipLauncher()
      renderLayerList()
      renderSwitcherMonitors()
      notifyOutputLayers()
      scheduleSessionCache()
      return
    }

    if (command.type === 'next') {
      if (!state.clipColumns.length) return
      const nextIndex = (state.activeColumnIndex + 1) % state.clipColumns.length
      setActiveClipCell(state.activeMixerRow, nextIndex)
      renderSwitcherMonitors()
      return
    }

    if (command.type === 'prev') {
      if (!state.clipColumns.length) return
      const prevIndex = state.activeColumnIndex <= 0 ? state.clipColumns.length - 1 : state.activeColumnIndex - 1
      setActiveClipCell(state.activeMixerRow, prevIndex)
      renderSwitcherMonitors()
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
  let savedSession = null
  if (window.mediaLayers?.sessionLoadState) {
    try {
      savedSession = await window.mediaLayers.sessionLoadState()
    } catch (error) {
      console.warn('[DAW] Falha ao carregar sessão salva', error)
    }
  }

  initState(savedSession)
  setupBuiltinPlugins()
  exposeLegacyGlobals()
  registerNdiFrameHandler()
  registerRemoteCommands()
  await loadRemoteControlInfo()
  await loadUpdateConfig()
  await loadTelemetryState()
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
  scheduleSessionCache()
})

window.addEventListener('error', (event) => {
  reportRendererError('controller-window', event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  })
})

window.addEventListener('unhandledrejection', (event) => {
  reportRendererError('controller-window', event.reason instanceof Error ? event.reason : new Error(String(event.reason)))
})

window.addEventListener('beforeunload', async () => {
  if (state.session.saveTimer) {
    clearTimeout(state.session.saveTimer)
    state.session.saveTimer = null
  }

  if (window.mediaLayers?.sessionCacheState) {
    window.mediaLayers.sessionCacheState(serializeSessionState())
  }

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
