// ════════════════════════════════════════════════════════════════
// app-daw.js - TESTE SIMPLIFICADO
// ════════════════════════════════════════════════════════════════

console.log('🎬 app-daw.js loaded successfully!')

// Teste simples: mostrar mensagem na tela
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 DOMContentLoaded fired')

  const container = document.getElementById('golden-layout-container')
  if (container) {
    container.innerHTML = `
      <div style="padding: 20px; background: #2d2d2d; color: white; font-family: Arial; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1>🎬 MediaLayers DAW</h1>
        <p>Interface carregada com sucesso!</p>
        <p>Golden Layout será inicializado em seguida...</p>
        <button onclick="initGoldenLayout()" style="padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 20px auto;">
          Inicializar Golden Layout
        </button>
        <div id="status" style="margin-top: 20px; color: #00ff00;">Aguardando inicialização...</div>
      </div>
    `
    console.log('✅ Test message displayed')
  } else {
    console.error('❌ Container not found')
  }
})

// Função de teste para Golden Layout
function initGoldenLayout() {
  console.log('🚀 initGoldenLayout called')

  const statusEl = document.getElementById('status')
  if (statusEl) statusEl.textContent = 'Inicializando Golden Layout...'

  const container = document.getElementById('golden-layout-container')
  if (!container) {
    console.error('❌ Container not found')
    if (statusEl) statusEl.textContent = '❌ Erro: Container não encontrado'
    return
  }

  try {
    // Configuração simples
    const config = {
      content: [{
        type: 'row',
        content: [
          {
            type: 'component',
            componentName: 'timeline',
            height: 25
          },
          {
            type: 'component',
            componentName: 'layers',
            height: 75
          }
        ]
      }]
    }

    const goldenLayout = new GoldenLayout(config, container)
    console.log('✅ GoldenLayout instance created')

    if (statusEl) statusEl.textContent = '✅ GoldenLayout criado, registrando componentes...'

    // Registrar componentes simples
    goldenLayout.registerComponent('timeline', function(container, state) {
      container.getElement().html('<div style="padding:10px;background:#2d2d2d;color:white;height:100%;">🎬 Timeline Panel</div>')
    })

    goldenLayout.registerComponent('layers', function(container, state) {
      container.getElement().html('<div style="padding:10px;background:#1a1a1a;color:white;height:100%;">📊 Layers Panel</div>')
    })

    if (statusEl) statusEl.textContent = '✅ Componentes registrados, inicializando...'

    goldenLayout.init()
    console.log('✅ Golden Layout initialized successfully!')

    if (statusEl) statusEl.textContent = '✅ Golden Layout inicializado com sucesso!'

  } catch (error) {
    console.error('❌ Error initializing Golden Layout:', error)
    if (statusEl) statusEl.textContent = `❌ Erro: ${error.message}`
  }
}