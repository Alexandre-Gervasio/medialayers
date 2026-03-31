// ════════════════════════════════════════════════════════════════
// plugins-examples.js
// Exemplos de Plugins para MediaLayers
// ════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────
// PLUGIN 1: TEXTO ANIMADO
// ─────────────────────────────────────────────────
class AnimatedTextPlugin extends MediaLayersPlugin {
  constructor() {
    super('Animated Text', '1.0', 'MediaLayers Team')
  }

  getLayerType() {
    return {
      name: 'animated-text',
      label: 'Texto Animado',
      icon: '📝'
    }
  }

  getPropertiesPanel(layer) {
    return `
      <div class="plugin-properties">
        <h4>Texto Animado</h4>
        <label>Texto: <input type="text" id="anim-text" value="${layer.text || ''}"></label>
        <label>Velocidade: <input type="range" id="anim-speed" min="1" max="10" value="${layer.speed || 5}"></label>
        <label>Cor: <input type="color" id="anim-color" value="${layer.color || '#ffffff'}"></label>
        <label>Tamanho: <input type="number" id="anim-size" min="12" max="200" value="${layer.fontSize || 48}"></label>
      </div>
    `
  }

  renderLayer(ctx, layer, canvas) {
    if (!layer.text) return

    const time = Date.now() * 0.001 * (layer.speed || 5)
    const x = Math.sin(time) * 50 + canvas.width / 2
    const y = canvas.height / 2

    ctx.save()
    ctx.fillStyle = layer.color || '#ffffff'
    ctx.font = `${layer.fontSize || 48}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(layer.text, x, y)
    ctx.restore()
  }
}

// ─────────────────────────────────────────────────
// PLUGIN 2: EFEITO GLITCH
// ─────────────────────────────────────────────────
class GlitchPlugin extends MediaLayersPlugin {
  constructor() {
    super('Glitch Effect', '1.0', 'MediaLayers Team')
  }

  getLayerType() {
    return {
      name: 'glitch',
      label: 'Efeito Glitch',
      icon: '⚡'
    }
  }

  getPropertiesPanel(layer) {
    return `
      <div class="plugin-properties">
        <h4>Efeito Glitch</h4>
        <label>Intensidade: <input type="range" id="glitch-intensity" min="1" max="20" value="${layer.intensity || 5}"></label>
        <label>Velocidade: <input type="range" id="glitch-speed" min="1" max="10" value="${layer.speed || 3}"></label>
      </div>
    `
  }

  renderLayer(ctx, layer, canvas) {
    // Aplica efeito glitch ao canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    const intensity = layer.intensity || 5
    const time = Date.now() * 0.001 * (layer.speed || 3)

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.sin(time + i * 0.01) * intensity
      data[i] += noise     // R
      data[i + 1] -= noise // G
      data[i + 2] += noise // B
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

// ─────────────────────────────────────────────────
// PLUGIN 3: FILTRO DE COR
// ─────────────────────────────────────────────────
class ColorFilterPlugin extends MediaLayersPlugin {
  constructor() {
    super('Color Filter', '1.0', 'MediaLayers Team')
  }

  getToolbarButtons() {
    return [
      {
        id: 'sepia-filter',
        label: 'Sépia',
        icon: '🏜️',
        action: () => this.applyFilter('sepia')
      },
      {
        id: 'invert-filter',
        label: 'Inverter',
        icon: '🔄',
        action: () => this.applyFilter('invert')
      }
    ]
  }

  applyFilter(type) {
    // Aplica filtro à layer selecionada
    if (!selectedLayerId) return

    const result = getLayerById(selectedLayerId)
    if (!result) return

    const { layer, row, col } = result
    layer.filter = type
    renderPreview(row, col)
    renderProperties()
  }

  renderLayer(ctx, layer, canvas) {
    if (!layer.filter) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    switch (layer.filter) {
      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))     // R
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168)) // G
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131)) // B
        }
        break

      case 'invert':
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]         // R
          data[i + 1] = 255 - data[i + 1] // G
          data[i + 2] = 255 - data[i + 2] // B
        }
        break
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

// ─────────────────────────────────────────────────
// REGISTRAR PLUGINS DE EXEMPLO
// ─────────────────────────────────────────────────
function registerExamplePlugins() {
  // Registrar plugins
  pluginManager.register(AnimatedTextPlugin)
  pluginManager.register(GlitchPlugin)
  pluginManager.register(ColorFilterPlugin)

  // Carregar e habilitar plugins
  pluginManager.load('Animated Text')
  pluginManager.load('Glitch Effect')
  pluginManager.load('Color Filter')

  pluginManager.enable('Animated Text')
  pluginManager.enable('Glitch Effect')
  pluginManager.enable('Color Filter')

  console.log('✓ Plugins de exemplo registrados e carregados')
}

// Exportar função de registro
window.registerExamplePlugins = registerExamplePlugins
