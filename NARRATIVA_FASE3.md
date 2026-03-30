# 🎨 MediaLayers Fase 3 - Painéis Dockáveis (Interface Dinâmica)

## 📖 NARRATIVA COMPLETA: Sistema de Painéis Redimensionáveis

Bem-vindo à **Fase 3**! Aqui implementamos um sistema profissional de **painéis dockáveis** que permite ao operador arranjar a interface exatamente como deseja!

---

## 🎯 O Objetivo da Fase 3

Transformar a interface **rígida** em uma interface **flexível e profissional**:

```
ANTES (Fase 2): Layout fixo
┌─────────────────────────────────────┐
│ [Esquerda]  [Centro] [Direita]     │  ← Sempre assim
│ (Editor)    (Grid)   (Props)       │
└─────────────────────────────────────┘

DEPOIS (Fase 3): Layout dinâmico
┌─────────────────────────────────────┐
│ [Grid] [Output A] [Output B]       │  ← Operador escolhe!
│ [Props]           [Saída]          │
│        [Editor]                    │
└─────────────────────────────────────┘
```

---

## 🏗️ Arquitetura: Classe `DockablePanel`

### O que é um Painel Dockável?

Uma **caixa que pode**:
- 🖱️ **Ser arrastada** para qualquer lugar (drag & drop)
- 📏 **Ser redimensionada** puxando no canto inferior
- 📌 **Estar acoplada** (docked) ao layout principal
- 🔲 **Flutuar** como janela independente (floating)
- 📋 **Ser minimizada** para economizar espaço
- ❌ **Ser fechada** (removida do DOM)
- 💾 **Ter sua posição salva** em localStorage

### Estrutura da Classe

```javascript
class DockablePanel {
  constructor(id, name, element, defaultX, defaultY, defaultW, defaultH)
    // Criar estrutura DOM com header + content + resize handle
    
  startDrag(e)        // Início do arrasto
  onDrag(e)           // Durante arrasto
  stopDrag(e)         // Fim do arrasto
  
  startResize(e)      // Início do redimensionamento
  onResize(e)         // Durante redimensionamento
  stopResize(e)       // Fim do redimensionamento
  
  toggleFloat()       // Flutuar ⛶ / Acoplar
  minimize()          // Minimizar − / Expandir
  close()             // Fechar ×
  
  savePosition()      // Salvar em localStorage
  getState()          // Obter estado para salvamento
  setState(state)     // Restaurar estado
}
```

---

## 🔧 Implementação Técnica

### 1. Estrutura DOM do Painel

```html
<div class="dockable-panel" id="panel-editor">
  <!-- Header (para drag) -->
  <div class="panel-header-dockable">
    <span class="panel-title">Editor</span>
    <div class="panel-header-buttons">
      <button class="panel-btn" data-action="toggle-float">⛶</button>
      <button class="panel-btn" data-action="minimize">−</button>
      <button class="panel-btn" data-action="close">×</button>
    </div>
  </div>
  
  <!-- Conteúdo -->
  <div class="panel-content-dockable">
    <!--Elemento original aqui-->
  </div>
  
  <!-- Handle de resize -->
  <div class="panel-resize-handle">⤡</div>
</div>
```

### 2. Evento: Drag & Drop

```javascript
startDrag(e) {
  this.isDragging = true
  this.dragStart = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    panelX: this.position.x,
    panelY: this.position.y
  }
  // Adicionar classe "dragging" para feedback visual
}

onDrag(e) {
  if (!this.isDragging) return
  
  // Calcular delta
  const deltaX = e.clientX - this.dragStart.mouseX
  const deltaY = e.clientY - this.dragStart.mouseY
  
  // Atualizar posição em tempo real
  this.position.x = this.dragStart.panelX + deltaX
  this.position.y = this.dragStart.panelY + deltaY
  
  // Aplicar CSS
  this.panelElement.style.left = `${this.position.x}px`
  this.panelElement.style.top = `${this.position.y}px`
}

stopDrag(e) {
  // Salvar posição em localStorage
  this.savePosition()
}
```

### 3. Evento: Resize

```javascript
startResize(e) {
  this.isResizing = true
  this.resizeHandle = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    panelW: this.position.w,
    panelH: this.position.h
  }
}

onResize(e) {
  const deltaX = e.clientX - this.resizeHandle.mouseX
  const deltaY = e.clientY - this.resizeHandle.mouseY
  
  // Respeitar tamanho mínimo
  this.position.w = Math.max(this.minSize.w, this.resizeHandle.panelW + deltaX)
  this.position.h = Math.max(this.minSize.h, this.resizeHandle.panelH + deltaY)
  
  this.panelElement.style.width = `${this.position.w}px`
  this.panelElement.style.height = `${this.position.h}px`
}

stopResize(e) {
  // Disparar evento resize para conteúdo se reorganizar
  window.dispatchEvent(new Event('resize'))
  
  this.savePosition()
}
```

### 4. Ações: Flutuar / Minimizar / Fechar

```javascript
toggleFloat() {
  this.isDocked = !this.isDocked
  
  if (!this.isDocked) {
    // Transformar em janela flutuante
    this.panelElement.classList.add('floating')
    this.panelElement.style.position = 'fixed'
    this.panelElement.style.zIndex = 1000
  } else {
    // Voltar a layout acoplado
    this.panelElement.classList.remove('floating')
    this.panelElement.style.position = 'initial'
  }
}

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
}

close() {
  this.panelElement.remove()  // Remover do DOM
}
```

### 5. Persistência: localStorage

```javascript
savePosition() {
  const layoutData = {
    panels: window.layoutManager.getPanelStates()
  }
  localStorage.setItem('medialayers-dockable-layout', JSON.stringify(layoutData))
  console.log('💾 Layout salvo')
}

getState() {
  return {
    id: this.id,
    name: this.name,
    isDocked: this.isDocked,
    isVisible: this.isVisible,
    position: { ...this.position }
  }
}

setState(state) {
  this.isDocked = state.isDocked
  this.isVisible = state.isVisible
  this.position = { ...state.position }
  
  // Restaurar visualmente
  this.panelElement.style.left = `${this.position.x}px`
  this.panelElement.style.top = `${this.position.y}px`
  this.panelElement.style.width = `${this.position.w}px`
  this.panelElement.style.height = `${this.position.h}px`
  
  if (!this.isVisible) {
    // ... minimizar
  }
}
```

---

## 📊 Classe: `LayoutManager`

Gerencia múltiplos painéis e presets de layout:

```javascript
class LayoutManager {
  registerPanel(panel)
  getPanelStates()        // Array de todos os painéis e suas posições
  saveLayout(presetName)  // Salvar layout atual com nome
  loadLayout(presetName)  // Carregar layout anterior
  resetToDefault()        // Voltar ao layout padrão
}
```

### Uso:

```javascript
// Registrar painel
const panel = new DockablePanel('editor', 'Editor', element, 0, 0, 280, 600)
window.layoutManager.registerPanel(panel)

// Salvar layout customizado
window.layoutManager.saveLayout('meu-layout-favorito')

// Carregar depois
window.layoutManager.loadLayout('meu-layout-favorito')

// Resetar tudo
window.layoutManager.resetToDefault()
```

---

## 🎨 CSS: Estilização dos Painéis

### Classe: `.dockable-panel`

```css
.dockable-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  position: absolute;              ← Permite posicionamento livre
  box-shadow: 0 4px 12px rgba(...) ← Sombra para profundidade
}

.dockable-panel.floating {
  position: fixed;                 ← Janela flutuante
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(...) ← Sombra maior
}

.dockable-panel.dragging {
  opacity: 0.8;                    ← Feedback visual
  box-shadow: 0 12px 32px rgba(233, 69, 96, 0.4) ← Rosa (accent)
}

.dockable-panel.resizing {
  cursor: nwse-resize;             ← Cursor diagonal
}

.dockable-panel.minimized {
  height: auto;
  min-height: 35px;                ← Só header visível
}
```

### Header: `.panel-header-dockable`

```css
.panel-header-dockable {
  display: flex;
  padding: 8px 12px;
  background: var(--bg-item);
  border-bottom: 1px solid var(--border);
  cursor: move;  ← Ícone de mão ao passar mouse
  gap: 8px;
}

.panel-title {
  flex: 1;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
}

.panel-btn {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-btn:hover {
  background: var(--bg-light);
  color: var(--accent);  ← Fica rosa ao hover
}
```

### Resize Handle

```css
.panel-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, transparent 50%, var(--border) 50%);
  cursor: nwse-resize;
  opacity: 0.3;           ← Discreto
}

.panel-resize-handle:hover {
  opacity: 0.7;
  background: linear-gradient(135deg, transparent 50%, var(--accent) 50%);
}
```

---

## 🎮 Interface: Presets de Layout

### No Header (Fase 3):

```
📐 Layout: [Padrão (3-painéis) ▼] [💾] [↻]
```

#### Presets Disponíveis:

1. **Default (3-painéis)**
   - Layout padrão original
   - Esquerda: Editor
   - Centro: Grid + Saída
   - Direita: Propriedades

2. **Full Grid**
   - Grid em tela cheia
   - Outros painéis minimizados
   - Perfeito para seleção rápida de clips

3. **Full Props**
   - Propriedades em tela cheia
   - Para ajuste fino de layers

4. **Output Focus**
   - Aba Saída em destaque
   - Para broadcasting foca no programa

### Botões:

- **💾 (Salvar)**: Salva layout atual com nome customizado
- **↻ (Resetar)**: Volta ao layout padrão

---

## 🔄 Fluxo de Uso Típico

### Cenário 1: Operador Quer Maximizar o Grid

```
1️⃣ Clica em "Grid em Tela Cheia" no preset
   ↓
2️⃣ Layout automático ajusta:
   - Editor: minimizado
   - Grid: maximizado
   - Propriedades: minimizado
   - Saída: flutuante (corner overlay)
   ↓
3️⃣ Operador clica muitas vezes no grid
   ↓
4️⃣ Clica "Padrão" para voltar ao normal
```

### Cenário 2: Operador Customiza Layout

```
1️⃣ Arrasta o painel "Saída" para canto superior direito
   (drag & drop)
   
2️⃣ Redimensiona puxando o canto (resize handle)

3️⃣ Minimiza "Propriedades" para economizar espaço
   (clica − no header)

4️⃣ Clica 💾 (Salvar) e digita: "broadcast-preset"
   ↓
5️⃣ Layout salvo em localStorage

6️⃣ Próxima vez que abrir, pode carregar:
   Select: "broadcast-preset"
   ↓
   Layout restaurado exatamente como estava!
```

### Cenário 3: Operador Coloca Painel em Janela Flutuante

```
1️⃣ Clica ⛶ (toggle float) no header de um painel

2️⃣ Painel agora é uma janela fixa em cima de todo
   - position: fixed em vez de absolute
   - z-index: 1000 (sempre no topo)
   - Pode mover para outro monitor (TODO: implementar)

3️⃣ Para voltar a acoplar, clica ⛶ novamente
```

---

## 💾 Persistência em localStorage

### O que é salvo:

```javascript
{
  "medialayers-dockable-layout": {
    panels: [
      {
        id: "editor",
        name: "Editor",
        isDocked: true,
        isVisible: true,
        position: { x: 0, y: 50, w: 280, h: 600 }
      },
      {
        id: "grid",
        name: "Grid",
        isDocked: true,
        isVisible: true,
        position: { x: 280, y: 50, w: 800, h: 600 }
      },
      // ... mais painéis
    ]
  }
}
```

### Ao recarregar:

```javascript
// App carrega localStorage
const saved = localStorage.getItem('medialayers-dockable-layout')
if (saved) {
  const layout = JSON.parse(saved)
  layout.panels.forEach(state => {
    const panel = layoutManager.panels.get(state.id)
    panel.setState(state)  // Restaura posição, visibilidade, etc
  })
}
```

---

## 🧪 Interação Implementada

### Events:

| Evento | O quê | Resultado |
|--------|-------|-----------|
| `mousedown` header | Começa drag | Painel segue mouse |
| `mousemove` | Durante drag | Posição atualiza em tempo real |
| `mouseup` | Fim drag | Posição salva em localStorage |
| `mousedown` resize handle | Começa resize | Cursor muda para ↖ ↗ |
| `mousemove` | Durante resize | Tamanho atualiza, min 200×150px |
| `mouseup` | Fim resize | Tamanho salvo, evento resize dispara |
| `click` ⛶ | Toggle float | Painel vira flutuante/acoplado |
| `click` − | Minimize | Conteúdo desaparece, header fica |
| `click` × | Close | Painel removido do DOM |

---

## 📐 Recursos Avançados (TODO para Próximas Versões)

- [ ] **Snap-to-grid**: Painéis se snappam para posições (8px grid)
- [ ] **Multi-monitor**: Arrastar painel para outro monitor
- [ ] **Tabs no painel**: Múltiplas abas dentro de um painel (como Chrome)
- [ ] **Panel groups**: Agrupar painéis para arrastar juntos
- [ ] **Presets mais visuais**: Tema claro/escuro, diferentes disposições
- [ ] **Undo/Redo**: Desfazer movimentos de painel
- [ ] **Animations**: Transições suaves ao minimizar/expandir

---

## 🎯 Conclusão Fase 3

**O que foi entregue:**

✅ Classe `DockablePanel` completa com drag & drop  
✅ Redimensionamento com resize handle  
✅ Ações: flutuar, minimizar, fechar  
✅ Persistência em localStorage  
✅ Classe `LayoutManager` para gerenciar múltiplos painéis  
✅ Presets de layout (4 predefinidos)  
✅ CSS profissional com transições e feedback visual  
✅ Interface clara com botões no header  

**Próximas Fases:**

- Fase 4: Drag & Drop de mídia
- Fase 5: Mesa de Corte (switching)
- Fase 6: Plugins modulares
- Fase 7: Vídeo remoto
- Fase 8: Controle celular

---

**Fase 3 PRONTA!** 🎨 Interface profissional como Resolume Arena, Ableton Live, ou Nuke!

---

**Fase 3 Completada**: 30 de março de 2026
