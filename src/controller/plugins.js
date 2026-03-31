// ════════════════════════════════════════════════════════════════
// plugins.js
// MEDIALAYERS Fase 6 - Sistema de Plugins Modulares
// ════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────
// CLASSE BASE PARA PLUGINS
// ─────────────────────────────────────────────────
class MediaLayersPlugin {
  constructor(name, version, author = 'Unknown') {
    this.name = name
    this.version = version
    this.author = author
    this.enabled = false
    this.settings = {}
  }

  // Lifecycle methods
  onLoad() {
    console.log(`✓ Plugin "${this.name}" v${this.version} loaded`)
  }

  onUnload() {
    console.log(`✓ Plugin "${this.name}" unloaded`)
  }

  onEnable() {
    this.enabled = true
    console.log(`✓ Plugin "${this.name}" enabled`)
  }

  onDisable() {
    this.enabled = false
    console.log(`✓ Plugin "${this.name}" disabled`)
  }

  // UI methods
  getLayerType() {
    return null // Override to return custom layer type
  }

  getToolbarButtons() {
    return [] // Override to return custom toolbar buttons
  }

  getPropertiesPanel(layer) {
    return null // Override to return custom properties UI
  }

  // Rendering methods
  renderLayer(ctx, layer, canvas) {
    // Override for custom layer rendering
  }

  // Settings
  getSettings() {
    return this.settings
  }

  setSetting(key, value) {
    this.settings[key] = value
    this.saveSettings()
  }

  saveSettings() {
    const key = `plugin_${this.name}_settings`
    localStorage.setItem(key, JSON.stringify(this.settings))
  }

  loadSettings() {
    const key = `plugin_${this.name}_settings`
    const saved = localStorage.getItem(key)
    if (saved) {
      this.settings = JSON.parse(saved)
    }
  }
}

// ─────────────────────────────────────────────────
// GERENCIADOR DE PLUGINS
// ─────────────────────────────────────────────────
class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.loadedPlugins = new Set()
  }

  // Registrar plugin
  register(pluginClass) {
    const plugin = new pluginClass()
    this.plugins.set(plugin.name, plugin)
    console.log(`✓ Plugin "${plugin.name}" registered`)
    return plugin
  }

  // Carregar plugin
  load(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) {
      console.error(`Plugin "${pluginName}" not found`)
      return false
    }

    if (this.loadedPlugins.has(pluginName)) {
      console.warn(`Plugin "${pluginName}" already loaded`)
      return true
    }

    try {
      plugin.loadSettings()
      plugin.onLoad()
      this.loadedPlugins.add(pluginName)
      return true
    } catch (error) {
      console.error(`Failed to load plugin "${pluginName}":`, error)
      return false
    }
  }

  // Descarregar plugin
  unload(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return false

    if (!this.loadedPlugins.has(pluginName)) return true

    try {
      plugin.onUnload()
      this.loadedPlugins.delete(pluginName)
      return true
    } catch (error) {
      console.error(`Failed to unload plugin "${pluginName}":`, error)
      return false
    }
  }

  // Habilitar plugin
  enable(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin || !this.loadedPlugins.has(pluginName)) return false

    plugin.onEnable()
    return true
  }

  // Desabilitar plugin
  disable(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return false

    plugin.onDisable()
    return true
  }

  // Obter plugin
  get(pluginName) {
    return this.plugins.get(pluginName)
  }

  // Listar plugins
  list() {
    return Array.from(this.plugins.keys())
  }

  // Listar plugins carregados
  listLoaded() {
    return Array.from(this.loadedPlugins)
  }

  // Obter tipos de layer customizados
  getCustomLayerTypes() {
    const types = []
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        const type = plugin.getLayerType()
        if (type) {
          types.push({
            ...type,
            pluginName: plugin.name,
            pluginClass: plugin
          })
        }
      }
    }
    return types
  }

  // Obter botões de toolbar customizados
  getCustomToolbarButtons() {
    const buttons = []
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        buttons.push(...plugin.getToolbarButtons())
      }
    }
    return buttons
  }

  // Renderizar layer customizada
  renderCustomLayer(ctx, layer, canvas) {
    const plugin = this.plugins.get(layer.pluginName)
    if (plugin && plugin.enabled) {
      plugin.renderLayer(ctx, layer, canvas)
      return true
    }
    return false
  }

  // Obter painel de propriedades customizado
  getCustomPropertiesPanel(layer) {
    if (layer.pluginName) {
      const plugin = this.plugins.get(layer.pluginName)
      if (plugin && plugin.enabled) {
        return plugin.getPropertiesPanel(layer)
      }
    }
    return null
  }
}

// ─────────────────────────────────────────────────
// INSTÂNCIA GLOBAL
// ─────────────────────────────────────────────────
const pluginManager = new PluginManager()

// Exportar para uso global
window.MediaLayersPlugins = {
  Plugin: MediaLayersPlugin,
  manager: pluginManager
}
