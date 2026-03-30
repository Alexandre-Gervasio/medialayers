// ============================================================
// src/stream/stream-controller.js
// Parte 7: Interface de stream/gravação no painel de controle
// Importado no index.html do controller
// ============================================================

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
let streamActive  = false
let recordActive  = false
let recordOutFile = null
let captureInterval = null
const STREAM_FPS  = 30

// ─────────────────────────────────────────────
// INICIALIZAÇÃO — cria o painel no header
// ─────────────────────────────────────────────
async function initStream() {
  const status = await window.mediaLayers.streamGetStatus()
  buildStreamPanel(status)
}

function buildStreamPanel(status) {
  // Remove painel anterior se existir
  const old = document.getElementById('stream-panel')
  if (old) old.remove()

  const panel = document.createElement('div')
  panel.id = 'stream-panel'
  panel.style.cssText = `
    display:flex; align-items:center; gap:6px;
    background:#0f2030; border-radius:8px;
    padding:4px 10px; margin-right:8px;
    border:1px solid #1a3a5a;
  `

  panel.innerHTML = `
    <span style="font-size:0.7rem;color:#888;">STREAM</span>

    <!-- Botão Stream -->
    <button id="btn-stream-toggle" title="Iniciar/Parar stream RTMP"
      style="background:${streamActive ? '#dc2626' : '#1a3a5a'};color:${streamActive ? '#fff' : '#aaa'};
             border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:600;">
      ${streamActive ? '⏹ Parar Stream' : '📡 Stream'}
    </button>

    <!-- Botão Gravação -->
    <button id="btn-record-toggle" title="Iniciar/Parar gravação local"
      style="background:${recordActive ? '#dc2626' : '#1a3a5a'};color:${recordActive ? '#fff' : '#aaa'};
             border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:600;">
      ${recordActive ? '⏹ Parar Rec' : '⏺ Gravar'}
    </button>

    <!-- Indicador ao vivo -->
    <span id="stream-status-dot" style="
      width:8px;height:8px;border-radius:50%;
      background:${streamActive || recordActive ? '#4ade80' : '#374151'};
      display:inline-block;
      ${streamActive || recordActive ? 'animation:pulse 1.5s infinite;' : ''}
    "></span>

    ${!status.ffmpegFound ? '<span style="font-size:10px;color:#f87171;" title="Instale o FFmpeg e adicione ao PATH">⚠ FFmpeg</span>' : ''}
  `

  const headerRight = document.querySelector('.header-right')
  const displayPanel = document.getElementById('display-panel')
  if (displayPanel) {
    headerRight.insertBefore(panel, displayPanel.nextSibling)
  } else {
    headerRight.insertBefore(panel, headerRight.firstChild)
  }

  document.getElementById('btn-stream-toggle').addEventListener('click', toggleStream)
  document.getElementById('btn-record-toggle').addEventListener('click', toggleRecord)
}

// ─────────────────────────────────────────────
// TOGGLE STREAM
// ─────────────────────────────────────────────
async function toggleStream() {
  if (streamActive) {
    stopCapture('stream')
    await window.mediaLayers.streamStop()
    streamActive = false
    refreshStreamPanel()
    return
  }

  // Pede configurações ao usuário
  const config = await showStreamDialog()
  if (!config) return

  try {
    await window.mediaLayers.streamStart(config)
    streamActive = true
    startCapture('stream')
    refreshStreamPanel()
    console.log('[Stream] Iniciado:', config.rtmpUrl)
  } catch (e) {
    alert('Erro ao iniciar stream:\n' + e.message)
  }
}

// ─────────────────────────────────────────────
// TOGGLE GRAVAÇÃO
// ─────────────────────────────────────────────
async function toggleRecord() {
  if (recordActive) {
    stopCapture('record')
    await window.mediaLayers.recordStop()
    recordActive  = false
    recordOutFile = null
    refreshStreamPanel()
    return
  }

  const config = await showRecordDialog()
  if (!config) return

  try {
    recordOutFile = await window.mediaLayers.recordStart(config)
    recordActive  = true
    startCapture('record')
    refreshStreamPanel()
    console.log('[Record] Gravando em:', recordOutFile)
  } catch (e) {
    alert('Erro ao iniciar gravação:\n' + e.message)
  }
}

// ─────────────────────────────────────────────
// CAPTURA DE FRAMES DA JANELA DE SAÍDA
// Usa webContents.capturePage via IPC
// ─────────────────────────────────────────────
function startCapture(mode) {
  if (captureInterval) return  // já rodando (stream+record simultâneos usam o mesmo loop)

  captureInterval = setInterval(async () => {
    try {
      const frameData = await window.mediaLayers.captureOutputFrame()
      if (!frameData) return

      if (streamActive && (mode === 'stream' || mode === 'both')) {
        await window.mediaLayers.streamSendFrame(frameData)
      }
      if (recordActive && (mode === 'record' || mode === 'both')) {
        await window.mediaLayers.recordSendFrame(frameData)
      }
      // Após iniciar ambos, atualiza modo
      if (streamActive && recordActive) mode = 'both'
    } catch (e) {
      console.warn('[Capture] Erro no frame:', e.message)
    }
  }, 1000 / STREAM_FPS)
}

function stopCapture(stoppedMode) {
  const stillRunning =
    (stoppedMode === 'stream' && recordActive) ||
    (stoppedMode === 'record' && streamActive)

  if (!stillRunning) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}

// ─────────────────────────────────────────────
// DIÁLOGOS
// ─────────────────────────────────────────────
function showStreamDialog() {
  return new Promise((resolve) => {
    // Cria modal simples
    const overlay = createModal(`
      <h3 style="color:#e94560;margin-bottom:16px;">📡 Configurar Stream</h3>

      <div style="display:flex;flex-direction:column;gap:10px;">

        <label style="font-size:11px;color:#888;">Plataforma</label>
        <select id="sd-platform" style="${inputStyle}">
          <option value="custom">URL personalizada</option>
          <option value="youtube">YouTube Live</option>
          <option value="twitch">Twitch</option>
          <option value="facebook">Facebook Live</option>
        </select>

        <label style="font-size:11px;color:#888;">Chave do Stream (Stream Key)</label>
        <input id="sd-key" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" style="${inputStyle}">

        <label style="font-size:11px;color:#888;" id="sd-url-label">URL RTMP (opcional para plataformas)</label>
        <input id="sd-url" type="text" placeholder="rtmp://..." style="${inputStyle}">

        <label style="font-size:11px;color:#888;">Resolução</label>
        <select id="sd-res" style="${inputStyle}">
          <option value="1920x1080">1920×1080 (Full HD)</option>
          <option value="1280x720">1280×720 (HD)</option>
          <option value="854x480">854×480 (SD)</option>
        </select>

        <label style="font-size:11px;color:#888;">Bitrate de vídeo</label>
        <select id="sd-bitrate" style="${inputStyle}">
          <option value="6000k">6000 kbps (Alta qualidade)</option>
          <option value="4500k" selected>4500 kbps (Recomendado)</option>
          <option value="2500k">2500 kbps (Baixo consumo)</option>
        </select>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="sd-cancel" style="${btnStyle('#374151','#aaa')}">Cancelar</button>
          <button id="sd-ok"     style="${btnStyle('#e94560','#fff')}">▶ Iniciar Stream</button>
        </div>
      </div>
    `)

    // Atualiza URL ao mudar plataforma
    const platform = overlay.querySelector('#sd-platform')
    const urlInput = overlay.querySelector('#sd-url')
    const urlLabel = overlay.querySelector('#sd-url-label')

    const rtmpBases = {
      youtube:  'rtmp://a.rtmp.youtube.com/live2',
      twitch:   'rtmp://live.twitch.tv/app',
      facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
      custom:   ''
    }

    platform.addEventListener('change', () => {
      const base = rtmpBases[platform.value]
      urlInput.value = base
      urlInput.readOnly = platform.value !== 'custom'
      urlLabel.textContent = platform.value === 'custom' ? 'URL RTMP completa' : 'URL Base (automática)'
    })

    overlay.querySelector('#sd-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay)
      resolve(null)
    })

    overlay.querySelector('#sd-ok').addEventListener('click', () => {
      const key      = overlay.querySelector('#sd-key').value.trim()
      const base     = urlInput.value.trim() || rtmpBases[platform.value]
      const rtmpUrl  = platform.value === 'custom' ? base : `${base}/${key}`
      const [w, h]   = overlay.querySelector('#sd-res').value.split('x').map(Number)
      const bitrate  = overlay.querySelector('#sd-bitrate').value

      if (!rtmpUrl || (!key && platform.value !== 'custom')) {
        alert('Informe a chave do stream.')
        return
      }

      document.body.removeChild(overlay)
      resolve({ rtmpUrl, width: w, height: h, bitrate, fps: 30 })
    })
  })
}

function showRecordDialog() {
  return new Promise((resolve) => {
    const overlay = createModal(`
      <h3 style="color:#4ade80;margin-bottom:16px;">⏺ Configurar Gravação</h3>

      <div style="display:flex;flex-direction:column;gap:10px;">

        <label style="font-size:11px;color:#888;">Resolução</label>
        <select id="rd-res" style="${inputStyle}">
          <option value="1920x1080">1920×1080 (Full HD)</option>
          <option value="1280x720">1280×720 (HD)</option>
        </select>

        <label style="font-size:11px;color:#888;">Formato</label>
        <select id="rd-format" style="${inputStyle}">
          <option value="mp4">MP4 (recomendado)</option>
          <option value="mkv">MKV</option>
          <option value="mov">MOV</option>
        </select>

        <label style="font-size:11px;color:#888;">Qualidade</label>
        <select id="rd-quality" style="${inputStyle}">
          <option value="18">Alta (CRF 18)</option>
          <option value="23" selected>Média (CRF 23)</option>
          <option value="28">Baixa (CRF 28)</option>
        </select>

        <p style="font-size:10px;color:#666;margin-top:4px;">
          Arquivo salvo em: Vídeos/MediaLayers/
        </p>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="rd-cancel" style="${btnStyle('#374151','#aaa')}">Cancelar</button>
          <button id="rd-ok"     style="${btnStyle('#4ade80','#000')}">⏺ Iniciar Gravação</button>
        </div>
      </div>
    `)

    overlay.querySelector('#rd-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay)
      resolve(null)
    })

    overlay.querySelector('#rd-ok').addEventListener('click', () => {
      const [w, h] = overlay.querySelector('#rd-res').value.split('x').map(Number)
      const format = overlay.querySelector('#rd-format').value
      const crf    = parseInt(overlay.querySelector('#rd-quality').value)

      document.body.removeChild(overlay)
      resolve({ width: w, height: h, format, crf, fps: 30 })
    })
  })
}

// ─────────────────────────────────────────────
// HELPERS DE UI
// ─────────────────────────────────────────────
const inputStyle = `
  background:#1a2a4a;border:1px solid #1f3560;border-radius:6px;
  color:#e0e0e0;padding:6px 10px;font-size:12px;width:100%;outline:none;
`
const btnStyle = (bg, color) => `
  flex:1;padding:8px;border:none;border-radius:6px;
  background:${bg};color:${color};cursor:pointer;font-size:12px;font-weight:600;
`

function createModal(innerHtml) {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;z-index:99999;
  `
  const box = document.createElement('div')
  box.style.cssText = `
    background:#16213e;border:1px solid #1f3560;border-radius:12px;
    padding:24px;width:380px;max-width:95vw;color:#e0e0e0;font-size:13px;
    font-family:'Segoe UI',sans-serif;
  `
  box.innerHTML = innerHtml
  overlay.appendChild(box)
  document.body.appendChild(overlay)
  return overlay
}

function refreshStreamPanel() {
  const btn   = document.getElementById('btn-stream-toggle')
  const btnR  = document.getElementById('btn-record-toggle')
  const dot   = document.getElementById('stream-status-dot')

  if (btn) {
    btn.textContent = streamActive ? '⏹ Parar Stream' : '📡 Stream'
    btn.style.background = streamActive ? '#dc2626' : '#1a3a5a'
    btn.style.color      = streamActive ? '#fff'    : '#aaa'
  }
  if (btnR) {
    btnR.textContent = recordActive ? '⏹ Parar Rec' : '⏺ Gravar'
    btnR.style.background = recordActive ? '#dc2626' : '#1a3a5a'
    btnR.style.color      = recordActive ? '#fff'    : '#aaa'
  }
  if (dot) {
    const on = streamActive || recordActive
    dot.style.background  = on ? '#4ade80' : '#374151'
    dot.style.animation   = on ? 'pulse 1.5s infinite' : 'none'
  }
}

// ─────────────────────────────────────────────
// INICIALIZA
// ─────────────────────────────────────────────
initStream()
