// ============================================================
// src/extensions/biblia/biblia-extension.js
// Parte 9: Extensão Bíblia
// Busca e apresenta versículos na saída
// ============================================================

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
let bibliaResults    = []    // versículos buscados
let bibliaSelected   = []    // versículos selecionados p/ apresentar
let bibliaIndex      = 0     // índice atual na apresentação
let bibliaLayerId    = null  // id da camada de texto ativa
let bibliaVersion    = 'NVI' // tradução ativa

const BIBLE_BOOKS = [
  'Gênesis','Êxodo','Levítico','Números','Deuteronômio','Josué','Juízes','Rute',
  '1 Samuel','2 Samuel','1 Reis','2 Reis','1 Crônicas','2 Crônicas','Esdras',
  'Neemias','Ester','Jó','Salmos','Provérbios','Eclesiastes','Cantares','Isaías',
  'Jeremias','Lamentações','Ezequiel','Daniel','Oséias','Joel','Amós','Obadias',
  'Jonas','Miquéias','Naum','Habacuque','Sofonias','Ageu','Zacarias','Malaquias',
  'Mateus','Marcos','Lucas','João','Atos','Romanos','1 Coríntios','2 Coríntios',
  'Gálatas','Efésios','Filipenses','Colossenses','1 Tessalonicenses','2 Tessalonicenses',
  '1 Timóteo','2 Timóteo','Tito','Filemom','Hebreus','Tiago','1 Pedro','2 Pedro',
  '1 João','2 João','3 João','Judas','Apocalipse'
]

// ─────────────────────────────────────────────
// BOTÃO NA TOOLBAR
// ─────────────────────────────────────────────
function initBiblia() {
  const toolbar = document.querySelector('.layer-add-buttons')
  if (!toolbar) return

  const btn = document.createElement('button')
  btn.className   = 'btn btn-sm'
  btn.id          = 'btn-add-biblia'
  btn.title       = 'Bíblia'
  btn.textContent = '✝'
  btn.addEventListener('click', openBibliaPanel)
  toolbar.appendChild(btn)
}

// ─────────────────────────────────────────────
// PAINEL PRINCIPAL
// ─────────────────────────────────────────────
function openBibliaPanel() {
  const old = document.getElementById('biblia-modal')
  if (old) old.remove()

  const overlay = document.createElement('div')
  overlay.id = 'biblia-modal'
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);
    display:flex;align-items:center;justify-content:center;z-index:99998;
  `

  overlay.innerHTML = `
    <div style="
      background:#16213e;border:1px solid #1f3560;border-radius:12px;
      width:740px;max-width:96vw;height:580px;max-height:93vh;
      display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;color:#e0e0e0;overflow:hidden;
    ">

      <!-- Header -->
      <div style="padding:14px 20px;border-bottom:1px solid #1f3560;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <span style="font-size:1rem;font-weight:700;color:#a78bfa;">✝ Bíblia Sagrada</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <!-- Seletor de tradução -->
          <select id="biblia-version" style="
            background:#0d0d1a;border:1px solid #1f3560;border-radius:6px;
            color:#e0e0e0;padding:4px 8px;font-size:11px;outline:none;
          ">
            <option value="NVI">NVI</option>
            <option value="ARA">ARA</option>
            <option value="ACF">ACF</option>
            <option value="NTLH">NTLH</option>
            <option value="KJA">KJA</option>
          </select>
          <button id="biblia-btn-close" style="${bBtn('#374151','#aaa')}">✕</button>
        </div>
      </div>

      <!-- Busca -->
      <div style="padding:12px 20px;border-bottom:1px solid #1f3560;flex-shrink:0;display:flex;flex-direction:column;gap:8px;">

        <!-- Busca por referência -->
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="biblia-book" style="${selStyle}">
            ${BIBLE_BOOKS.map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
          <input id="biblia-chapter" type="number" min="1" placeholder="Cap" style="${numStyle}">
          <span style="color:#666;font-size:12px;">:</span>
          <input id="biblia-verse-start" type="number" min="1" placeholder="Ver" style="${numStyle}">
          <span style="color:#666;font-size:12px;">–</span>
          <input id="biblia-verse-end"   type="number" min="1" placeholder="Fim" style="${numStyle}">
          <button id="biblia-btn-ref"    style="${bBtn('#a78bfa','#fff')}">Buscar</button>
        </div>

        <!-- Busca por texto -->
        <div style="display:flex;gap:8px;">
          <input id="biblia-text-search" type="text" placeholder="🔍 Buscar por palavra ou trecho..."
            style="${inputFull}margin-top:0;">
          <button id="biblia-btn-text" style="${bBtn('#6366f1','#fff')}">Buscar</button>
        </div>
      </div>

      <!-- Corpo: resultados esq + apresentação dir -->
      <div style="display:flex;flex:1;overflow:hidden;">

        <!-- Resultados -->
        <div style="width:320px;border-right:1px solid #1f3560;display:flex;flex-direction:column;flex-shrink:0;">
          <div style="padding:6px 12px;font-size:10px;color:#666;border-bottom:1px solid #0f2040;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <span id="biblia-result-count">—</span>
            <button id="biblia-add-all" style="${bBtn('#1a3a5a','#aaa')}font-size:10px;padding:2px 8px;">
              + Todos
            </button>
          </div>
          <ul id="biblia-results" style="flex:1;overflow-y:auto;list-style:none;margin:0;padding:4px;"></ul>
        </div>

        <!-- Apresentação -->
        <div style="flex:1;display:flex;flex-direction:column;padding:14px;gap:10px;overflow:hidden;">

          <!-- Fila de versículos selecionados -->
          <div style="flex-shrink:0;">
            <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">
              Fila de apresentação
              <button id="biblia-clear-queue" style="${bBtn('#3a1a1a','#f87171')}font-size:9px;padding:1px 6px;margin-left:8px;">Limpar</button>
            </div>
            <div id="biblia-queue" style="
              display:flex;flex-wrap:wrap;gap:4px;max-height:60px;overflow-y:auto;
              background:#0d0d1a;border-radius:6px;border:1px solid #1f3560;padding:6px;min-height:30px;
            ">
              <span style="color:#444;font-size:11px;align-self:center;" id="biblia-queue-empty">Nenhum versículo selecionado.</span>
            </div>
          </div>

          <!-- Preview do versículo atual -->
          <div style="flex:1;background:#000;border-radius:8px;border:1px solid #1f3560;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;overflow:hidden;">
            <p id="biblia-preview-ref"  style="font-size:11px;color:#a78bfa;margin-bottom:8px;text-align:center;"></p>
            <p id="biblia-preview-text" style="
              color:#fff;font-size:20px;font-weight:600;text-align:center;
              text-shadow:2px 2px 8px rgba(0,0,0,0.8);white-space:pre-wrap;line-height:1.6;
            ">Selecione versículos ao lado.</p>
          </div>

          <!-- Controles de navegação -->
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <button id="biblia-prev" style="${bBtn('#1a2a4a','#e0e0e0')}">◀</button>
            <span id="biblia-pos" style="flex:1;text-align:center;font-size:11px;color:#888;">— / —</span>
            <button id="biblia-next" style="${bBtn('#1a2a4a','#e0e0e0')}">▶</button>
          </div>

          <!-- Ações -->
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button id="biblia-send-btn"  style="${bBtn('#a78bfa','#fff')}">▶ Enviar para Saída</button>
            <button id="biblia-clear-btn" style="${bBtn('#374151','#aaa')}">⬛ Limpar</button>
          </div>
        </div>

      </div>
    </div>
  `

  document.body.appendChild(overlay)

  // Eventos
  document.getElementById('biblia-btn-close').addEventListener('click', () => overlay.remove())
  document.getElementById('biblia-version').addEventListener('change', e => { bibliaVersion = e.target.value })
  document.getElementById('biblia-btn-ref').addEventListener('click', searchByReference)
  document.getElementById('biblia-btn-text').addEventListener('click', searchByText)
  document.getElementById('biblia-text-search').addEventListener('keydown', e => { if (e.key === 'Enter') searchByText() })
  document.getElementById('biblia-add-all').addEventListener('click', addAllToQueue)
  document.getElementById('biblia-clear-queue').addEventListener('click', clearQueue)
  document.getElementById('biblia-prev').addEventListener('click', () => navigateBiblia(-1))
  document.getElementById('biblia-next').addEventListener('click', () => navigateBiblia(1))
  document.getElementById('biblia-send-btn').addEventListener('click', sendBibliaToOutput)
  document.getElementById('biblia-clear-btn').addEventListener('click', clearBibliaFromOutput)

  updateBibliaQueue()
}

// ─────────────────────────────────────────────
// BUSCA POR REFERÊNCIA
// ─────────────────────────────────────────────
async function searchByReference() {
  const book    = document.getElementById('biblia-book').value
  const chapter = parseInt(document.getElementById('biblia-chapter').value) || 1
  const vStart  = parseInt(document.getElementById('biblia-verse-start').value) || 1
  const vEnd    = parseInt(document.getElementById('biblia-verse-end').value) || vStart

  try {
    const results = await window.mediaLayers.bibliaSearch({
      type: 'reference', book, chapter, verseStart: vStart, verseEnd: vEnd, version: bibliaVersion
    })
    bibliaResults = results
    renderBibliaResults()
  } catch (e) {
    alert('Erro ao buscar: ' + e.message)
  }
}

// ─────────────────────────────────────────────
// BUSCA POR TEXTO
// ─────────────────────────────────────────────
async function searchByText() {
  const query = document.getElementById('biblia-text-search').value.trim()
  if (!query) return

  try {
    const results = await window.mediaLayers.bibliaSearch({
      type: 'text', query, version: bibliaVersion
    })
    bibliaResults = results
    renderBibliaResults()
  } catch (e) {
    alert('Erro ao buscar: ' + e.message)
  }
}

// ─────────────────────────────────────────────
// RENDERIZAR RESULTADOS
// ─────────────────────────────────────────────
function renderBibliaResults() {
  const ul    = document.getElementById('biblia-results')
  const count = document.getElementById('biblia-result-count')
  if (!ul) return

  count.textContent = `${bibliaResults.length} versículo(s)`
  ul.innerHTML = ''

  if (bibliaResults.length === 0) {
    ul.innerHTML = '<li style="color:#666;font-size:11px;text-align:center;padding:20px;">Nenhum resultado.</li>'
    return
  }

  bibliaResults.forEach((v, i) => {
    const li = document.createElement('li')
    li.style.cssText = `
      padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:3px;
      border:1px solid transparent;transition:background 0.15s;
    `
    const alreadyIn = bibliaSelected.some(s => s.ref === v.ref)
    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
        <div style="flex:1;">
          <div style="font-size:10px;color:#a78bfa;font-weight:600;margin-bottom:2px;">${v.ref}</div>
          <div style="font-size:11px;color:#ccc;line-height:1.4;">${v.text.slice(0, 100)}${v.text.length > 100 ? '…' : ''}</div>
        </div>
        <button data-idx="${i}" class="biblia-add-btn" style="
          ${bBtn(alreadyIn ? '#1a4a2a' : '#1a2a4a', alreadyIn ? '#4ade80' : '#888')}
          font-size:10px;padding:2px 7px;flex-shrink:0;
        ">${alreadyIn ? '✓' : '+'}</button>
      </div>
    `
    li.addEventListener('mouseenter', () => li.style.background = '#1a2a4a')
    li.addEventListener('mouseleave', () => li.style.background = 'transparent')
    ul.appendChild(li)
  })

  ul.querySelectorAll('.biblia-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const idx = parseInt(btn.dataset.idx)
      addToQueue(bibliaResults[idx])
      renderBibliaResults()
    })
  })
}

// ─────────────────────────────────────────────
// FILA DE VERSÍCULOS
// ─────────────────────────────────────────────
function addToQueue(verse) {
  if (bibliaSelected.some(s => s.ref === verse.ref)) return
  bibliaSelected.push(verse)
  if (bibliaSelected.length === 1) {
    bibliaIndex = 0
    updateBibliaPreview()
  }
  updateBibliaQueue()
}

function addAllToQueue() {
  bibliaResults.forEach(v => addToQueue(v))
}

function clearQueue() {
  bibliaSelected = []
  bibliaIndex    = 0
  updateBibliaQueue()
  updateBibliaPreview()
}

function updateBibliaQueue() {
  const container = document.getElementById('biblia-queue')
  const empty     = document.getElementById('biblia-queue-empty')
  if (!container) return

  // Remove chips antigos
  container.querySelectorAll('.biblia-chip').forEach(c => c.remove())

  if (bibliaSelected.length === 0) {
    if (empty) empty.style.display = 'block'
    return
  }
  if (empty) empty.style.display = 'none'

  bibliaSelected.forEach((v, i) => {
    const chip = document.createElement('div')
    chip.className = 'biblia-chip'
    chip.style.cssText = `
      display:inline-flex;align-items:center;gap:4px;
      padding:2px 8px;border-radius:4px;font-size:10px;cursor:pointer;
      background:${i === bibliaIndex ? '#a78bfa' : '#1a2a4a'};
      color:${i === bibliaIndex ? '#fff' : '#888'};
      border:1px solid ${i === bibliaIndex ? '#a78bfa' : '#1f3560'};
    `
    chip.innerHTML = `
      <span>${v.ref}</span>
      <span class="chip-remove" data-i="${i}" style="color:${i === bibliaIndex ? '#fff' : '#666'};font-size:9px;cursor:pointer;margin-left:2px;">✕</span>
    `
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip-remove')) {
        const idx = parseInt(e.target.dataset.i)
        bibliaSelected.splice(idx, 1)
        if (bibliaIndex >= bibliaSelected.length) bibliaIndex = Math.max(0, bibliaSelected.length - 1)
        updateBibliaQueue()
        updateBibliaPreview()
        renderBibliaResults()
        return
      }
      bibliaIndex = i
      updateBibliaQueue()
      updateBibliaPreview()
    })
    container.appendChild(chip)
  })

  updateBibliaPos()
}

function updateBibliaPos() {
  const pos = document.getElementById('biblia-pos')
  if (pos) pos.textContent = bibliaSelected.length
    ? `${bibliaIndex + 1} / ${bibliaSelected.length}`
    : '— / —'
}

function updateBibliaPreview() {
  const refEl  = document.getElementById('biblia-preview-ref')
  const textEl = document.getElementById('biblia-preview-text')
  if (!refEl || !textEl) return

  if (bibliaSelected.length === 0) {
    refEl.textContent  = ''
    textEl.textContent = 'Selecione versículos ao lado.'
    return
  }

  const v = bibliaSelected[bibliaIndex]
  refEl.textContent  = `${v.ref} (${bibliaVersion})`
  textEl.textContent = v.text
  updateBibliaPos()
}

function navigateBiblia(dir) {
  const newIdx = bibliaIndex + dir
  if (newIdx < 0 || newIdx >= bibliaSelected.length) return
  bibliaIndex = newIdx
  updateBibliaQueue()
  updateBibliaPreview()
}

// ─────────────────────────────────────────────
// ENVIAR PARA SAÍDA
// ─────────────────────────────────────────────
function sendBibliaToOutput() {
  if (bibliaSelected.length === 0) return
  const v    = bibliaSelected[bibliaIndex]
  const text = `${v.text}\n\n— ${v.ref} (${bibliaVersion})`

  if (bibliaLayerId) {
    const layer = layers.find(l => l.id === bibliaLayerId)
    if (layer) {
      layer.text    = text
      layer.name    = `✝ ${v.ref}`
      layer.visible = true
      renderLayers()
      updatePreview()
      sendToOutput()
      return
    }
  }

  const layer = createLayer('text', `✝ ${v.ref}`)
  layer.text      = text
  layer.fontSize  = 36
  layer.fontColor = '#ffffff'
  layer.fontBg    = 'rgba(0,0,0,0.65)'
  layer.visible   = true
  layers.push(layer)
  bibliaLayerId = layer.id
  renderLayers()
  selectLayer(layer.id)
  updatePreview()
  sendToOutput()
}

function clearBibliaFromOutput() {
  if (bibliaLayerId) {
    deleteLayer(bibliaLayerId)
    bibliaLayerId = null
  }
}

// ─────────────────────────────────────────────
// ATALHOS DE TECLADO
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('biblia-modal')) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    navigateBiblia(1)
    sendBibliaToOutput()
    e.preventDefault()
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    navigateBiblia(-1)
    sendBibliaToOutput()
    e.preventDefault()
  }
})

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const bBtn = (bg, color) =>
  `background:${bg};color:${color};border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600;`

const selStyle = `
  background:#0d0d1a;border:1px solid #1f3560;border-radius:6px;
  color:#e0e0e0;padding:5px 8px;font-size:12px;outline:none;max-width:160px;
`
const numStyle = `
  background:#0d0d1a;border:1px solid #1f3560;border-radius:6px;
  color:#e0e0e0;padding:5px 6px;font-size:12px;outline:none;width:52px;
`
const inputFull = `
  background:#0d0d1a;border:1px solid #1f3560;border-radius:6px;
  color:#e0e0e0;padding:6px 10px;font-size:12px;width:100%;outline:none;
  font-family:'Segoe UI',sans-serif;flex:1;
`

// ─────────────────────────────────────────────
// INICIALIZA
// ─────────────────────────────────────────────
initBiblia()
