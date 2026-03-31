// ════════════════════════════════════════════════════════════════
// app-daw.js
// MediaLayers Fase 7.5 - DAW Interface com Golden Layout
// ════════════════════════════════════════════════════════════════

console.log('🎬 app-daw.js loaded successfully!')

let goldenLayout

// ─────────────────────────────────────────────────
// INICIALIZAÇÃO DO GOLDEN LAYOUT
// ─────────────────────────────────────────────────
function initGoldenLayout() {
  console.log('🚀 initGoldenLayout called')

  const container = document.getElementById('golden-layout-container')
  if (!container) {
    console.error('❌ Container #golden-layout-container not found!')
    return
  }

  try {
    // Configuração simplificada
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
            componentName: 'main',
            height: 75
          }
        ]
      }]
    }

    goldenLayout = new GoldenLayout(config, container)
    console.log('✅ GoldenLayout instance created')

    // Registrar componentes
    goldenLayout.registerComponent('timeline', function(container, state) {
      container.getElement().html(`
        <div style="padding:10px;background:#2d2d2d;color:white;height:100%;display:flex;align-items:center;">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <div>🎬 Timeline</div>
            <div style="display:flex;gap:5px;">
              <button style="padding:4px 8px;background:#404040;color:white;border:1px solid #555;border-radius:3px;">▶️</button>
              <button style="padding:4px 8px;background:#404040;color:white;border:1px solid #555;border-radius:3px;">⏸️</button>
              <button style="padding:4px 8px;background:#404040;color:white;border:1px solid #555;border-radius:3px;">⏹️</button>
              <span style="color:#00ff00;font-family:monospace;">00:00:00.000</span>
            </div>
          </div>
        </div>
      `)
    })

    goldenLayout.registerComponent('main', function(container, state) {
      container.getElement().html(`
        <div style="height:100%;display:flex;flex-direction:column;">
          <div style="padding:5px;background:#2d2d2d;border-bottom:1px solid #444;display:flex;gap:5px;">
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Vídeo">🎥</button>
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Imagem">🖼</button>
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Áudio">🔊</button>
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Texto">📝</button>
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Câmera">📷</button>
            <button style="padding:6px 10px;background:#404040;color:white;border:1px solid #555;border-radius:3px;" title="Remote">🌐</button>
            <button style="padding:6px 10px;background:#007acc;color:white;border:1px solid #0098ff;border-radius:3px;" title="WebRTC Server">🚀</button>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:2px;padding:10px;background:#1a1a1a;">
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">1x1<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">1x2<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">1x3<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">1x4<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">2x1<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">2x2<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">2x3<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">2x4<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">3x1<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">3x2<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">3x3<br>0 layers</div>
            <div style="background:#2d2d2d;border:2px solid #404040;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#ccc;">3x4<br>0 layers</div>
          </div>
        </div>
      `)
    })

    goldenLayout.init()
    console.log('✅ Golden Layout initialized successfully!')

  } catch (error) {
    console.error('❌ Error initializing Golden Layout:', error)
    // Fallback: mostrar mensagem de erro
    container.innerHTML = `
      <div style="padding: 20px; background: #2d2d2d; color: #ff6b6b; font-family: Arial; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1>❌ Erro no Golden Layout</h1>
        <p>${error.message}</p>
        <p>Verifique o console para mais detalhes.</p>
      </div>
    `
  }
}

// ─────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 DOMContentLoaded fired - initializing DAW interface...')
  setTimeout(initGoldenLayout, 100) // Pequeno delay para garantir que tudo está carregado
})
