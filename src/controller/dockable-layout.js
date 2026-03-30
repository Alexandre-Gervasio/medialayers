// ════════════════════════════════════════════════════════════════
// dockable-layout.js
// MEDIALAYERS Fase 3 - Sistema de Painéis Dockáveis e Redimensionáveis
// ════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────
// CLASSE: PAINEL DOCKÁVEL
// ─────────────────────────────────────────────────
class DockablePanel {
  constructor(id, name, element, defaultX, defaultY, defaultW, defaultH) {
    this.id = id                              // ID único
    this.name = name                          // Nome (Editor, Grid, Propriedades, etc)
    this.element = element                    // Elemento DOM
    this.isDocked = true                      // Acoplado vs flutuante
    this.isVisible = true                     // Visível vs minimizado
    this.isResizing = false
    this.isDragging = false
    
    // Posição e tamanho
    this.position = {
      x: defaultX,                            // Pixel X
      y: defaultY,                            // Pixel Y
      w: defaultW,                            // Largura em px
      h: defaultH,                            // Altura em px
    }
    
    // Tamanho mínimo
    this.minSize = {
      w: 200,
      h: 150
    }
    
    // Referências de dragging/resizing
    this.dragStart = null
    this.resizeHandle = null
    
    this.createLayout()
  }
  
  // ─────────────────────────────────────────────────
  // Criar estrutura DOM do painel
  // ─────────────────────────────────────────────────
  createLayout() {
    const panel = document.createElement('div')
    panel.id = `panel-${this.id}`
    panel.className = 'dockable-panel'
    panel.style.left = `${this.position.x}px`
    panel.style.top = `${this.position.y}px`
    panel.style.width = `${this.position.w}px`
    panel.style.height = `${this.position.h}px`
    
    // Header (para drag)
    const header = document.createElement('div')
    header.className = 'panel-header-dockable'
    header.innerHTML = `
      <span class="panel-title">${this.name}</span>
      <div class="panel-header-buttons">
        <button class="panel-btn" data-action="toggle-float" title="Flutuar/Acoplar">⛶</button>
        <button class="panel-btn" data-action="minimize" title="Minimizar">−</button>
        <button class="panel-btn" data-action="close" title="Fechar">×</button>
      </div>
    `
    
    // Content (painel original)
    const content = document.createElement('div')
    content.className = 'panel-content-dockable'
    content.appendChild(this.element)
    
    // Resize handle (canto inferior direito)
    const resizeHandle = document.createElement('div')
    resizeHandle.className = 'panel-resize-handle'
    resizeHandle.innerHTML = '⤡'
    
    // Montar estrutura
    panel.appendChild(header)
    panel.appendChild(content)
    panel.appendChild(resizeHandle)
    
    this.element.parentElement.replaceChild(panel, this.element)
    this.panelElement = panel
    
    // Event listeners
    this.setupListeners()
  }
  
  // ─────────────────────────────────────────────────
  // Setup de event listeners (drag, resize, botões)
  // ─────────────────────────────────────────────────
  setupListeners() {
    const header = this.panelElement.querySelector('.panel-header-dockable')
    const buttons = this.panelElement.querySelectorAll('.panel-btn')
    const resizeHandle = this.panelElement.querySelector('.panel-resize-handle')
    
    // DRAG
    header.addEventListener('mousedown', (e) => this.startDrag(e))
    document.addEventListener('mousemove', (e) => this.onDrag(e))
    document.addEventListener('mouseup', (e) => this.stopDrag(e))
    
    // RESIZE
    resizeHandle.addEventListener('mousedown', (e) => this.startResize(e))
    document.addEventListener('mousemove', (e) => this.onResize(e))
    document.addEventListener('mouseup', (e) => this.stopResize(e))
    
    // BOTÕES
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleButtonClick(e))
    })
  }
  
  // ─────────────────────────────────────────────────
  // FUNCIONALIDADES: DRAG
  // ─────────────────────────────────────────────────
  startDrag(e) {
    if (e.target.closest('.panel-btn')) return
    
    this.isDragging = true
    this.dragStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: this.position.x,
      panelY: this.position.y
    }
    
    this.panelElement.classList.add('dragging')
  }
  
  onDrag(e) {
    if (!this.isDragging) return
    
    const deltaX = e.clientX - this.dragStart.mouseX
    const deltaY = e.clientY - this.dragStart.mouseY
    
    this.position.x = this.dragStart.panelX + deltaX
    this.position.y = this.dragStart.panelY + deltaY
    
    this.panelElement.style.left = `${this.position.x}px`
    this.panelElement.style.top = `${this.position.y}px`
  }
  
  stopDrag(e) {
    if (!this.isDragging) return
    
    this.isDragging = false
    this.panelElement.classList.remove('dragging')
    
    // Salvar posição em localStorage
    this.savePosition()
  }
  
  // ─────────────────────────────────────────────────
  // FUNCIONALIDADES: RESIZE
  // ─────────────────────────────────────────────────
  startResize(e) {
    this.isResizing = true
    this.resizeHandle = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelW: this.position.w,
      panelH: this.position.h
    }
    
    this.panelElement.classList.add('resizing')
  }
  
  onResize(e) {
    if (!this.isResizing) return
    
    const deltaX = e.clientX - this.resizeHandle.mouseX
    const deltaY = e.clientY - this.resizeHandle.mouseY
    
    this.position.w = Math.max(this.minSize.w, this.resizeHandle.panelW + deltaX)
    this.position.h = Math.max(this.minSize.h, this.resizeHandle.panelH + deltaY)
    
    this.panelElement.style.width = `${this.position.w}px`
    this.panelElement.style.height = `${this.position.h}px`
  }
  
  stopResize(e) {
    if (!this.isResizing) return
    
    this.isResizing = false
    this.panelElement.classList.remove('resizing')
    
    // Disparar resize no conteúdo
    window.dispatchEvent(new Event('resize'))
    
    // Salvar posição e tamanho
    this.savePosition()
  }
  
  // ─────────────────────────────────────────────────
  // EVENT: Botões do painel
  // ─────────────────────────────────────────────────
  handleButtonClick(e) {
    const action = e.target.dataset.action
    
    switch (action) {
      case 'toggle-float':
        this.toggleFloat()
        break
      case 'minimize':
        this.minimize()
        break
      case 'close':
        this.close()
        break
    }
  }
  
  // ─────────────────────────────────────────────────
  // AÇÃO: Flutuar / Acoplar
  // ─────────────────────────────────────────────────
  toggleFloat() {
    this.isDocked = !this.isDocked
    
    if (this.isDocked) {
      // Voltar a layout docked (TODO: implementar grid layout)
      this.panelElement.classList.remove('floating')
      console.log(`✓ Painel "${this.name}" acoplado`)
    } else {
      // Transformar em janela flutuante
      this.panelElement.classList.add('floating')
      this.panelElement.style.position = 'fixed'
      this.panelElement.style.zIndex = 1000
      console.log(`✓ Painel "${this.name}" flutuando`)
    }
    
    this.savePosition()
  }
  
  // ─────────────────────────────────────────────────
  // AÇÃO: Minimizar
  // ─────────────────────────────────────────────────
  minimize() {
    const content = this.panelElement.querySelector('.panel-content-dockable')
    
    if (this.isVisible) {
      content.style.display = 'none'
      this.panelElement.classList.add('minimized')
      this.isVisible = false
    } else {
      content.style.display = 'flex'
      this.panelElement.classList.remove('minimized')
      this.isVisible = true
    }
    
    this.savePosition()
  }
  
  // ─────────────────────────────────────────────────
  // AÇÃO: Fechar (remover do DOM)
  // ─────────────────────────────────────────────────
  close() {
    this.panelElement.remove()
    console.log(`✓ Painel "${this.name}" fechado`)
  }
  
  // ─────────────────────────────────────────────────
  // SALVAR POSIÇÃO EM LOCALSTORAGE
  // ─────────────────────────────────────────────────
  savePosition() {
    const layoutData = {
      panels: window.layoutManager?.getPanelStates() || []
    }
    localStorage.setItem('medialayers-dockable-layout', JSON.stringify(layoutData))
    console.log(`💾 Layout salvo`)
  }
  
  // ─────────────────────────────────────────────────
  // OBTER ESTADO DO PAINEL
  // ─────────────────────────────────────────────────
  getState() {
    return {
      id: this.id,
      name: this.name,
      isDocked: this.isDocked,
      isVisible: this.isVisible,
      position: { ...this.position }
    }
  }
  
  // ─────────────────────────────────────────────────
  // RESTAURAR ESTADO
  // ─────────────────────────────────────────────────
  setState(state) {
    this.isDocked = state.isDocked
    this.isVisible = state.isVisible
    this.position = { ...state.position }
    
    this.panelElement.style.left = `${this.position.x}px`
    this.panelElement.style.top = `${this.position.y}px`
    this.panelElement.style.width = `${this.position.w}px`
    this.panelElement.style.height = `${this.position.h}px`
    
    if (!this.isVisible) {
      const content = this.panelElement.querySelector('.panel-content-dockable')
      content.style.display = 'none'
      this.panelElement.classList.add('minimized')
    }
    
    if (!this.isDocked) {
      this.panelElement.classList.add('floating')
      this.panelElement.style.position = 'fixed'
    }
  }
}

// ═════════════════════════════════════════════════════════════
// GERENCIADOR DE LAYOUT
// ═════════════════════════════════════════════════════════════
class LayoutManager {
  constructor() {
    this.panels = new Map()
    this.presets = {
      'default': 'Default (3-panel)',
      'fullscreen-grid': 'Full Grid',
      'fullscreen-props': 'Props Only',
      'output-focus': 'Output Focus'
    }
  }
  
  registerPanel(panel) {
    this.panels.set(panel.id, panel)
  }
  
  getPanelStates() {
    const states = []
    this.panels.forEach((panel) => {
      states.push(panel.getState())
    })
    return states
  }
  
  saveLayout(presetName = 'custom') {
    const states = this.getPanelStates()
    const layoutData = {
      name: presetName,
      timestamp: new Date().toISOString(),
      panels: states
    }
    localStorage.setItem(`medialayers-layout-${presetName}`, JSON.stringify(layoutData))
    console.log(`✓ Layout "${presetName}" salvo`)
  }
  
  loadLayout(presetName) {
    const data = localStorage.getItem(`medialayers-layout-${presetName}`)
    if (!data) {
      console.error(`✗ Layout "${presetName}" não encontrado`)
      return
    }
    
    const layout = JSON.parse(data)
    layout.panels.forEach(state => {
      const panel = this.panels.get(state.id)
      if (panel) {
        panel.setState(state)
      }
    })
    
    console.log(`✓ Layout "${presetName}" carregado`)
  }
  
  resetToDefault() {
    this.panels.forEach(panel => {
      // Resetar para posição padrão (TODO: store default positions)
      panel.isDocked = true
      panel.isVisible = true
      panel.panelElement.classList.remove('floating', 'minimized')
      panel.panelElement.style.position = 'initial'
    })
    console.log(`✓ Layout resetado`)
  }
}

// ─────────────────────────────────────────────────
// INICIALIZAR LAYOUT MANAGER GLOBAL
// ─────────────────────────────────────────────────
window.layoutManager = new LayoutManager()

// ─────────────────────────────────────────────────
// EXPORT (Para uso em app-grid-v2.js)
// ─────────────────────────────────────────────────
// (Em ambiente browser, já disponível globalmente)
