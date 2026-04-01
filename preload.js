// ============================================================
// preload.js — Ponte segura entre o Electron e o HTML
// Partes 4-9: monitores, NDI, stream, letras, bíblia
// ============================================================

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mediaLayers', {

  // ── Saída ────────────────────────────────────────────────
  sendToOutput:     (payload)   => ipcRenderer.send('send-to-output', payload),
  onCommand:        (callback)  => ipcRenderer.on('receive-command', (e, p) => callback(p)),
  outputReady:      ()          => ipcRenderer.send('output-ready'),

  // ── Monitores ────────────────────────────────────────────
  getDisplays:      ()          => ipcRenderer.invoke('get-displays'),
  openOutput:       (id)        => ipcRenderer.invoke('open-output', id),
  closeOutput:      (id)        => ipcRenderer.invoke('close-output', id),
  onOutputsUpdated: (callback)  => ipcRenderer.on('outputs-updated', (e, ids) => callback(ids)),
  onRemoteCommand: (callback)   => ipcRenderer.on('remote-control-command', (e, cmd) => callback(cmd)),
  getRemoteControlInfo: ()      => ipcRenderer.invoke('get-remote-control-info'),
  onRemoteControlInfo: (cb)     => ipcRenderer.on('remote-control-info', (e, data) => cb(data)),

  // ── Auto Update ───────────────────────────────────────────
  appUpdateGetConfig: ()        => ipcRenderer.invoke('app-update-get-config'),
  appUpdateSetConfig: (config)  => ipcRenderer.invoke('app-update-set-config', config),
  appUpdateCheck: ()            => ipcRenderer.invoke('app-update-check'),
  appUpdateInstall: ()          => ipcRenderer.invoke('app-update-install'),
  onAppUpdateStatus: (cb)       => ipcRenderer.on('app-update-status', (e, data) => cb(data)),

  // ── Telemetria / Diagnostico ──────────────────────────────
  telemetryGetState: ()         => ipcRenderer.invoke('telemetry-get-state'),
  telemetryReportError: (data)  => ipcRenderer.send('telemetry-report-error', data),
  onTelemetryUpdated: (cb)      => ipcRenderer.on('telemetry-updated', (e, data) => cb(data)),

  // ── Sessão / Persistência ─────────────────────────────────
  sessionLoadState: ()          => ipcRenderer.invoke('session-load-state'),
  sessionSaveState: (snapshot)  => ipcRenderer.invoke('session-save-state', snapshot),
  sessionCacheState: (snapshot) => ipcRenderer.send('session-cache-state', snapshot),

  // ── NDI ──────────────────────────────────────────────────
  ndiAvailable:       ()        => ipcRenderer.invoke('ndi-available'),
  ndiFindSources:     ()        => ipcRenderer.invoke('ndi-find-sources'),
  ndiStartReceiver:   (params)  => ipcRenderer.invoke('ndi-start-receiver', params),
  ndiStopReceiver:    (id)      => ipcRenderer.invoke('ndi-stop-receiver', id),
  ndiStartSender:     (name)    => ipcRenderer.invoke('ndi-start-sender', name),
  ndiStopSender:      ()        => ipcRenderer.invoke('ndi-stop-sender'),
  onNdiFrame:         (cb)      => ipcRenderer.on('ndi-frame', (e, d) => cb(d)),
  sendNdiOutputFrame: (data)    => ipcRenderer.send('ndi-output-frame', data),

  // ── Stream / Gravação ─────────────────────────────────────
  streamGetStatus:  ()          => ipcRenderer.invoke('stream-get-status'),
  streamStart:      (config)    => ipcRenderer.invoke('stream-start', config),
  streamStop:       ()          => ipcRenderer.invoke('stream-stop'),
  streamSendFrame:  (data)      => ipcRenderer.send('stream-send-frame', data),
  recordStart:      (config)    => ipcRenderer.invoke('record-start', config),
  recordStop:       ()          => ipcRenderer.invoke('record-stop'),
  recordSendFrame:  (data)      => ipcRenderer.send('record-send-frame', data),
  captureOutputFrame: ()        => ipcRenderer.invoke('capture-output-frame'),

  // ── Letras de Músicas ─────────────────────────────────────
  letrasGetAll:   ()            => ipcRenderer.invoke('letras-get-all'),
  letrasGet:      (id)          => ipcRenderer.invoke('letras-get', id),
  letrasCreate:   (data)        => ipcRenderer.invoke('letras-create', data),
  letrasUpdate:   (data)        => ipcRenderer.invoke('letras-update', data),
  letrasDelete:   (id)          => ipcRenderer.invoke('letras-delete', id),
  letrasSearch:   (query)       => ipcRenderer.invoke('letras-search', query),

  // ── Bíblia ────────────────────────────────────────────────
  bibliaSearch:       (params)  => ipcRenderer.invoke('biblia-search', params),
  bibliaListVersions: ()        => ipcRenderer.invoke('biblia-list-versions'),
  bibliaDownload:     (version) => ipcRenderer.invoke('biblia-download', version),
  bibliaImportJson:   (version) => ipcRenderer.invoke('biblia-import-json', version),
  onBibliaProgress:   (cb)      => ipcRenderer.on('biblia-download-progress', (e, d) => cb(d)),

})
