// ============================================================
// src/extensions/letras/letras-extension.js
// Parte 8: Extensão Letras de Música
// Banco SQLite local para salvar músicas e apresentar letra
// estrofe por estrofe na saída
// ============================================================

// ─────────────────────────────────────────────
// BANCO DE DADOS (via IPC → main.js → SQLite)
// ─────────────────────────────────────────────
// As operações de banco são feitas pelo main.js
// usando better-sqlite3 (já está no package.json)
// A extensão se comunica via window.mediaLayers.letras.*

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
let letrasSongs       = []    // lista de músicas do banco
let letrasSelected    = null  // { id, title, artist, slides: [] }
let letrasSlideIndex  = 0     // índice da estrofe atual
let letrasLayerId     = null  // id da camada de texto ativa

// ─────────────────────────────────────────────
// BOTÃO NA TOOLBAR
// ─────────────────────────────────────────────
function initLetras() {
  const toolbar = document.querySelector('.layer-add-buttons')
  if (!toolbar) return

  const btn = document.createElement('button')
  btn.className   = 'btn btn-sm'
  btn.id          = 'btn-add-letras'
  btn.title       = 'Letras de músicas'
  btn.textContent = '🎵'
  btn.addEventListener('click', openLetrasPanel)
  toolbar.appendChild(btn)
}

// ─────────────────────────────────────────────
// PAINEL PRINCIPAL
// ─────────────────────────────────────────────
async function openLetrasPanel() {
  letrasSongs = await window.mediaLayers.letrasGetAll()
  showLetrasModal()
}

function showLetrasModal() {
  const old = document.getElementById('letras-modal')
  if (old) old.remove()

  const overlay = document.createElement('div')
  overlay.id = 'letras-modal'
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.8);
    display:flex;align-items:center;justify-content:center;z-index:99998;
  `

  overlay.innerHTML = `
    <div style="
      background:#16213e;border:1px solid #1f3560;border-radius:12px;
      width:680px;max-width:96vw;height:560px;max-height:92vh;
      display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#e0e0e0;overflow:hidden;
    ">
      <!-- Header -->
      <div style="padding:16px 20px;border-bottom:1px solid #1f3560;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <span style="font-size:1rem;font-weight:700;color:#e94560;">🎵 Letras de Músicas</span>
        <div style="display:flex;gap:8px;">
          <button id="letras-btn-new"   style="${btnSm('#e94560','#fff')}">+ Nova Música</button>
          <button id="letras-btn-close" style="${btnSm('#374151','#aaa')}">✕</button>
        </div>
      </div>

      <!-- Corpo: lista esq + editor dir -->
      <div style="display:flex;flex:1;overflow:hidden;">

        <!-- Lista de músicas -->
        <div style="width:220px;border-right:1px solid #1f3560;display:flex;flex-direction:column;flex-shrink:0;">
          <input id="letras-search" type="text" placeholder="🔍 Buscar..."
            style="margin:8px;padding:6px 10px;background:#0d0d1a;border:1px solid #1f3560;
                   border-radius:6px;color:#e0e0e0;font-size:12px;outline:none;">
          <ul id="letras-list" style="flex:1;overflow-y:auto;list-style:none;margin:0;padding:4px;"></ul>
        </div>

        <!-- Editor / Apresentação -->
        <div id="letras-editor" style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:16px;gap:12px;">
          <p style="color:#666;font-size:0.8rem;text-align:center;margin-top:40px;">
            Selecione uma música ou clique em "+ Nova Música"
          </p>
        </div>

      </div>
    </div>
  `

  document.body.appendChild(overlay)

  document.getElementById('letras-btn-close').addEventListener('click', () => overlay.remove())
  document.getElementById('letras-btn-new').addEventListener('click', showLetrasEditor(null))
  document.getElementById('letras-search').addEventListener('input', (e) => {
    filterLetrasList(e.target.value)
  })

  renderLetrasList()
}

// ─────────────────────────────────────────────
// LISTA DE MÚSICAS
// ─────────────────────────────────────────────
function renderLetrasList(filter = '') {
  const ul = document.getElementById('letras-list')
  if (!ul) return
  ul.innerHTML = ''

  const filtered = filter
    ? letrasSongs.filter(s =>
        s.title.toLowerCase().includes(filter.toLowerCase()) ||
        (s.artist || '').toLowerCase().includes(filter.toLowerCase()))
    : letrasSongs

  if (filtered.length === 0) {
    ul.innerHTML = '<li style="color:#666;font-size:11px;text-align:center;padding:20px;">Nenhuma música encontrada.</li>'
    return
  }

  filtered.forEach(song => {
    const li = document.createElement('li')
    li.style.cssText = `
      padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:3px;
      background:${letrasSelected?.id === song.id ? '#2a1a2e' : 'transparent'};
      border:1px solid ${letrasSelected?.id === song.id ? '#e94560' : 'transparent'};
      transition:background 0.15s;
    `
    li.innerHTML = `
      <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${song.title}</div>
      <div style="font-size:10px;color:#666;">${song.artist || '—'}</div>
    `
    li.addEventListener('mouseenter', () => { if (letrasSelected?.id !== song.id) li.style.background = '#1a2a4a' })
    li.addEventListener('mouseleave', () => { if (letrasSelected?.id !== song.id) li.style.background = 'transparent' })
    li.addEventListener('click', () => loadSongForPresentation(song.id))
    ul.appendChild(li)
  })
}

function filterLetrasList(query) {
  renderLetrasList(query)
}

// ─────────────────────────────────────────────
// CARREGAR MÚSICA PARA APRESENTAÇÃO
// ─────────────────────────────────────────────
async function loadSongForPresentation(id) {
  const song = await window.mediaLayers.letrasGet(id)
  letrasSelected   = song
  letrasSlideIndex = 0
  renderLetrasPresentation()
  renderLetrasList(document.getElementById('letras-search')?.value || '')
}

function renderLetrasPresentation() {
  const editor = document.getElementById('letras-editor')
  if (!editor || !letrasSelected) return

  const slides = letrasSelected.slides || []
  const current = slides[letrasSlideIndex] || ''

  editor.innerHTML = `
    <!-- Info da música -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;">
      <div>
        <div style="font-size:14px;font-weight:700;">${letrasSelected.title}</div>
        <div style="font-size:11px;color:#888;">${letrasSelected.artist || ''}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button id="letras-edit-btn"   style="${btnSm('#1a3a5a','#aaa')}">✏ Editar</button>
        <button id="letras-delete-btn" style="${btnSm('#3a1a1a','#f87171')}">🗑</button>
      </div>
    </div>

    <!-- Preview do slide atual -->
    <div style="
      flex:1;background:#000;border-radius:8px;border:1px solid #1f3560;
      display:flex;align-items:center;justify-content:center;padding:16px;
      min-height:100px;
    ">
      <p style="
        color:#fff;font-size:22px;font-weight:700;text-align:center;
        text-shadow:2px 2px 8px rgba(0,0,0,0.8);white-space:pre-wrap;line-height:1.5;
      " id="letras-slide-preview">${current || '(vazio)'}</p>
    </div>

    <!-- Controles de navegação -->
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
      <button id="letras-prev" style="${btnSm('#1a2a4a','#e0e0e0')}">◀ Anterior</button>
      <span style="flex:1;text-align:center;font-size:11px;color:#888;">
        Estrofe <span id="letras-slide-num">${letrasSlideIndex + 1}</span> / ${slides.length}
      </span>
      <button id="letras-next" style="${btnSm('#1a2a4a','#e0e0e0')}">Próxima ▶</button>
    </div>

    <!-- Lista de estrofes (clicável) -->
    <div style="flex-shrink:0;">
      <div style="font-size:10px;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Estrofes</div>
      <div id="letras-slides-strip" style="display:flex;flex-wrap:wrap;gap:4px;max-height:90px;overflow-y:auto;"></div>
    </div>

    <!-- Ações de saída -->
    <div style="display:flex;gap:8px;flex-shrink:0;">
      <button id="letras-send-btn"  style="${btnSm('#e94560','#fff')}">▶ Enviar para Saída</button>
      <button id="letras-clear-btn" style="${btnSm('#374151','#aaa')}">⬛ Limpar</button>
    </div>
  `

  // Strip de estrofes
  const strip = document.getElementById('letras-slides-strip')
  slides.forEach((slide, i) => {
    const chip = document.createElement('div')
    chip.style.cssText = `
      padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;
      background:${i === letrasSlideIndex ? '#e94560' : '#1a2a4a'};
      color:${i === letrasSlideIndex ? '#fff' : '#888'};
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;
      border:1px solid ${i === letrasSlideIndex ? '#e94560' : '#1f3560'};
    `
    chip.textContent = slide.split('\n')[0].slice(0, 20) || `Estrofe ${i + 1}`
    chip.title = slide
    chip.addEventListener('click', () => {
      letrasSlideIndex = i
      renderLetrasPresentation()
    })
    strip.appendChild(chip)
  })

  // Eventos
  document.getElementById('letras-prev').addEventListener('click', () => {
    if (letrasSlideIndex > 0) { letrasSlideIndex--; renderLetrasPresentation() }
  })
  document.getElementById('letras-next').addEventListener('click', () => {
    if (letrasSlideIndex < slides.length - 1) { letrasSlideIndex++; renderLetrasPresentation() }
  })
  document.getElementById('letras-edit-btn').addEventListener('click', showLetrasEditor(letrasSelected))
  document.getElementById('letras-delete-btn').addEventListener('click', async () => {
    if (!confirm(`Excluir "${letrasSelected.title}"?`)) return
    await window.mediaLayers.letrasDelete(letrasSelected.id)
    letrasSongs   = letrasSongs.filter(s => s.id !== letrasSelected.id)
    letrasSelected = null
    renderLetrasList()
    document.getElementById('letras-editor').innerHTML =
      '<p style="color:#666;font-size:.8rem;text-align:center;margin-top:40px;">Selecione uma música.</p>'
  })
  document.getElementById('letras-send-btn').addEventListener('click', sendLetrasToOutput)
  document.getElementById('letras-clear-btn').addEventListener('click', clearLetrasFromOutput)
}

// ─────────────────────────────────────────────
// EDITOR DE MÚSICA (nova ou editar)
// ─────────────────────────────────────────────
function showLetrasEditor(song) {
  return async () => {
    const isNew = !song
    const old = document.getElementById('letras-edit-modal')
    if (old) old.remove()

    const overlay = document.createElement('div')
    overlay.id = 'letras-edit-modal'
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);
      display:flex;align-items:center;justify-content:center;z-index:99999;
    `
    overlay.innerHTML = `
      <div style="
        background:#16213e;border:1px solid #1f3560;border-radius:12px;
        width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;
        padding:24px;font-family:'Segoe UI',sans-serif;color:#e0e0e0;
      ">
        <h3 style="color:#e94560;margin-bottom:16px;">${isNew ? '+ Nova Música' : '✏ Editar Música'}</h3>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:11px;color:#888;">Título *</label>
            <input id="le-title" type="text" value="${song?.title || ''}"
              placeholder="Nome da música" style="${inputFull}">
          </div>
          <div>
            <label style="font-size:11px;color:#888;">Artista / Banda</label>
            <input id="le-artist" type="text" value="${song?.artist || ''}"
              placeholder="Nome do artista" style="${inputFull}">
          </div>
          <div>
            <label style="font-size:11px;color:#888;">
              Letra completa
              <span style="color:#666;"> — Separe estrofes com uma linha em branco</span>
            </label>
            <textarea id="le-lyrics" rows="14" placeholder="Estrofe 1...&#10;&#10;Estrofe 2..."
              style="${inputFull}resize:vertical;">${song ? (song.slides || []).join('\n\n') : ''}</textarea>
          </div>

          <div style="background:#0d0d1a;border-radius:6px;padding:10px;font-size:11px;color:#666;">
            <strong style="color:#888;">Dica:</strong> Separe cada estrofe/verso com uma linha vazia.
            Cada bloco será um slide separado na apresentação.
          </div>

          <div style="display:flex;gap:8px;margin-top:4px;">
            <button id="le-cancel" style="${btnSm('#374151','#aaa')}">Cancelar</button>
            <button id="le-save"   style="${btnSm('#e94560','#fff')}">💾 Salvar</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(overlay)

    overlay.querySelector('#le-cancel').addEventListener('click', () => overlay.remove())
    overlay.querySelector('#le-save').addEventListener('click', async () => {
      const title  = overlay.querySelector('#le-title').value.trim()
      const artist = overlay.querySelector('#le-artist').value.trim()
      const lyrics = overlay.querySelector('#le-lyrics').value

      if (!title) { alert('Informe o título da música.'); return }

      // Divide em estrofes (blocos separados por linha vazia)
      const slides = lyrics
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(Boolean)

      const data = { title, artist, slides }

      if (isNew) {
        const created = await window.mediaLayers.letrasCreate(data)
        letrasSongs.push(created)
      } else {
        await window.mediaLayers.letrasUpdate({ ...data, id: song.id })
        const idx = letrasSongs.findIndex(s => s.id === song.id)
        if (idx !== -1) letrasSongs[idx] = { ...letrasSongs[idx], title, artist }
        // Atualiza selecionada
        if (letrasSelected?.id === song.id) {
          letrasSelected = { ...letrasSelected, ...data }
          letrasSlideIndex = 0
        }
      }

      overlay.remove()
      renderLetrasList()
      if (!isNew && letrasSelected?.id === song.id) renderLetrasPresentation()
    })
  }
}

// ─────────────────────────────────────────────
// ENVIAR PARA SAÍDA
// ─────────────────────────────────────────────
function sendLetrasToOutput() {
  if (!letrasSelected) return
  const slides = letrasSelected.slides || []
  const text   = slides[letrasSlideIndex] || ''

  // Cria ou atualiza camada de texto
  if (letrasLayerId) {
    // Atualiza a camada existente
    const layer = layers.find(l => l.id === letrasLayerId)
    if (layer) {
      layer.text     = text
      layer.name     = `🎵 ${letrasSelected.title}`
      layer.visible  = true
      renderLayers()
      updatePreview()
      sendToOutput()
      return
    }
  }

  // Cria nova camada de texto
  const layer = createLayer('text', `🎵 ${letrasSelected.title}`)
  layer.text      = text
  layer.fontSize  = 42
  layer.fontColor = '#ffffff'
  layer.fontBg    = 'rgba(0,0,0,0.6)'
  layer.visible   = true
  layers.push(layer)
  letrasLayerId = layer.id
  renderLayers()
  selectLayer(layer.id)
  updatePreview()
  sendToOutput()
}

function clearLetrasFromOutput() {
  if (letrasLayerId) {
    deleteLayer(letrasLayerId)
    letrasLayerId = null
  }
}

// ─────────────────────────────────────────────
// ATALHOS DE TECLADO (quando modal aberto)
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('letras-modal')) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (letrasSelected && letrasSlideIndex < (letrasSelected.slides?.length || 0) - 1) {
      letrasSlideIndex++
      renderLetrasPresentation()
      sendLetrasToOutput()
      e.preventDefault()
    }
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (letrasSelected && letrasSlideIndex > 0) {
      letrasSlideIndex--
      renderLetrasPresentation()
      sendLetrasToOutput()
      e.preventDefault()
    }
  }
})

// ─────────────────────────────────────────────
// ESTILOS HELPERS
// ─────────────────────────────────────────────
const btnSm = (bg, color) =>
  `background:${bg};color:${color};border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:600;`

const inputFull = `
  background:#0d0d1a;border:1px solid #1f3560;border-radius:6px;
  color:#e0e0e0;padding:7px 10px;font-size:12px;width:100%;outline:none;
  font-family:'Segoe UI',sans-serif;margin-top:4px;
`

// ─────────────────────────────────────────────
// INICIALIZA
// ─────────────────────────────────────────────
initLetras()
