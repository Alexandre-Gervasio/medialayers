// ============================================================
// src/controller/ndi-controller.js
// Interface do painel de controle para NDI
// Importado no final do app.js
// ============================================================

// ─────────────────────────────────────────────
// BOTÃO NDI NO PAINEL DE CAMADAS
// Adiciona um botão 📡 NDI ao lado dos botões de adicionar
// ─────────────────────────────────────────────
async function initNDI() {
  const ndiAvailable = await window.mediaLayers.ndiAvailable()

  // Adiciona botão NDI na toolbar de camadas
  const toolbar = document.querySelector('.layer-add-buttons')
  if (toolbar) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-sm'
    btn.id        = 'btn-add-ndi'
    btn.title     = ndiAvailable ? 'Adicionar fonte NDI' : 'NDI não disponível (instale grandiose)'
    btn.textContent = '📡'
    btn.style.opacity = ndiAvailable ? '1' : '0.4'
    btn.disabled = !ndiAvailable
    btn.addEventListener('click', () => openNDISourcePicker())
    toolbar.appendChild(btn)
  }

  // Adiciona botão de saída NDI no header
  addNDIOutputButton()
}

// ─────────────────────────────────────────────
// PICKER DE FONTES NDI
// ─────────────────────────────────────────────
async function openNDISourcePicker() {
  // Mostra indicação de busca
  const btn = document.getElementById('btn-add-ndi')
  if (btn) { btn.textContent = '🔍'; btn.disabled = true }

  let sources = []
  try {
    sources = await window.mediaLayers.ndiFindSources()
  } catch (e) {
    alert('Erro ao buscar fontes NDI: ' + e.message)
  } finally {
    if (btn) { btn.textContent = '📡'; btn.disabled = false }
  }

  if (sources.length === 0) {
    alert('Nenhuma fonte NDI encontrada na rede.\n\nVerifique:\n• Dispositivos NDI estão na mesma rede\n• OBS com NDI plugin ativo\n• NewTek NDI Tools instalado')
    return
  }

  // Monta lista para o usuário escolher
  const list = sources.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
  const choice = prompt(`Fontes NDI encontradas:\n${list}\n\nDigite o número:`, '1')
  const idx = parseInt(choice) - 1
  if (isNaN(idx) || idx < 0 || idx >= sources.length) return

  addNDILayer(sources[idx], idx)
}

// ─────────────────────────────────────────────
// ADICIONAR CAMADA NDI
// ─────────────────────────────────────────────
async function addNDILayer(source, sourceIndex) {
  const layer = createLayer('ndi', source.name)
  layer.ndiSource      = source
  layer.ndiSourceIndex = sourceIndex
  layers.push(layer)
  renderLayers()
  selectLayer(layer.id)
  updatePreview()

  try {
    await window.mediaLayers.ndiStartReceiver({
      layerId:     layer.id,
      sourceIndex: sourceIndex
    })
    console.log('[NDI] Receiver iniciado para:', source.name)
    sendToOutput()
  } catch (e) {
    alert('Erro ao conectar à fonte NDI: ' + e.message)
    layers = layers.filter(l => l.id !== layer.id)
    renderLayers()
  }
}

// ─────────────────────────────────────────────
// SAÍDA NDI
// Publica o conteúdo da tela de saída como fonte NDI
// ─────────────────────────────────────────────
let ndiOutputActive = false

function addNDIOutputButton() {
  const headerRight = document.querySelector('.header-right')
  if (!headerRight) return

  const btn = document.createElement('button')
  btn.className   = 'btn'
  btn.id          = 'btn-ndi-output'
  btn.textContent = '📡 NDI Out'
  btn.style.cssText = 'background:#1a2a4a;color:#888;font-size:11px;'
  btn.addEventListener('click', toggleNDIOutput)
  // Insere antes do botão de limpar
  const clearBtn = document.getElementById('btn-clear-all')
  headerRight.insertBefore(btn, clearBtn)
}

async function toggleNDIOutput() {
  const btn = document.getElementById('btn-ndi-output')
  if (!btn) return

  if (!ndiOutputActive) {
    try {
      await window.mediaLayers.ndiStartSender('MediaLayers Output')
      ndiOutputActive = true
      btn.textContent = '📡 NDI Out ●'
      btn.style.color = '#4ade80'
      console.log('[NDI] Saída NDI ativada')
    } catch (e) {
      alert('Erro ao iniciar saída NDI: ' + e.message)
    }
  } else {
    await window.mediaLayers.ndiStopSender()
    ndiOutputActive = false
    btn.textContent = '📡 NDI Out'
    btn.style.color = '#888'
    console.log('[NDI] Saída NDI desativada')
  }
}

// Inicializa quando o DOM estiver pronto
initNDI()
