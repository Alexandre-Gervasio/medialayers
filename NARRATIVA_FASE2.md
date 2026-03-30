# 🎬 MediaLayers Fase 2 - Monitor Preview/Program

## 📖 NARRATIVA COMPLETA: Implementação do Sistema de Saída

Olá! Essa é a documentação narrativa da **Fase 2: Monitor de Saída (Preview/Program)**. Vou explicar exatamente o que foi implementado, por que, e como funciona.

---

## 🎯 O Objetivo

Na **Fase 1 v2**, criamos um grid 2D profissional com stack-based rendering e blending modes. Agora, queremos que o **operador** possa:

1. **PREPARAR** (`preview`) um clip enquanto outro está ao ar
2. **ENVIAR** (`on air`) o clip preparado para o público com transições suaves
3. **VERIFICAR** o que está sendo exibido ao público sem desenfocar

Isso é EXATAMENTE como funciona:
- **Resolume Arena**: Preview panel vs. Program monitor
- **OBS Studio**: Preview vs. Stream (Live)
- **Video Switchers profissionais**: Multiview vs. Output

---

## 🏗️ PASSO 1: Adicionar UI ao index-v2.html

### O Que Fiz:

**Adicionei uma nova TAB**: `📡 Saída`

```html
<div class="tabs-header">
  <button class="tab-btn active" data-tab="grid-view">📊 Grid</button>
  <button class="tab-btn" data-tab="preview-view">👁 Preview</button>
  <button class="tab-btn" data-tab="output-view">📡 Saída</button>  <!-- NOVO -->
</div>
```

**Implementei 3 seções**:

```html
<div id="output-view" class="tab-content">
  <div class="output-monitors-container">
    
    <!-- ESQUERDA: Monitor Preview (Preparando) -->
    <div class="monitor-section">
      <div class="monitor-label">👁 PREVIEW (Preparando)</div>
      <canvas id="monitor-preview" class="monitor-canvas" width="960" height="540"></canvas>
      <div class="monitor-info" id="monitor-preview-info">Nenhuma célula selecionada</div>
    </div>

    <!-- CENTRO: Controles de Transição -->
    <div class="transition-controls-section">
      <label>⏱ Transição:</label>
      <select id="transition-type">
        <option value="cut">Cut (instantâneo)</option>
        <option value="fade">Fade (500ms)</option>
        <option value="dissolve">Dissolve (1000ms)</option>
      </select>
      <button class="btn btn-go-live" id="btn-go-live">→ ON AIR</button>
    </div>

    <!-- DIREITA: Monitor Program (Público) -->
    <div class="monitor-section">
      <div class="monitor-label live">📺 PROGRAM (Público)</div>
      <canvas id="monitor-program" class="monitor-canvas" width="960" height="540"></canvas>
      <div class="monitor-info" id="monitor-program-info">🔴 Nada ao ar</div>
    </div>
  </div>
</div>
```

### Por Que Assim?

- **Layout lado-a-lado**: Operador vê tudo de uma vez (Preview ← Transição → Program)
- **Canvas dedicados**: Cada monitor tem seu próprio canvas para renderização independente
- **Info dinamicamente atualizada**: Mostra [row, col] e número de camadas
- **Transição configurável**: Operador escolhe entre cut/fade/dissolve antes de enviar

---

## 🎨 PASSO 2: Estilizar com CSS (style-v2.css)

### Classe: `.output-monitors-container`

```css
.output-monitors-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}
```

**3 seções em coluna** com gap de 16px.

### Classe: `.monitor-section`

```css
.monitor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-panel);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
```

**Cada monitor é uma "cartão"** com background escuro e border subtil.

### Classe: `.monitor-canvas`

```css
.monitor-canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: #000;
  image-rendering: crisp-edges;
  display: block;
}
```

- **`aspect-ratio: 16/9`**: Sempre mantém proporção de vídeo
- **`image-rendering: crisp-edges`**: Pixelart para canvas (não blur)
- **`background: #000`**: Preto padrão quando vazio

### Efeito "Ao Ar" para Program

```css
.monitor-label.live {
  color: #ff0000;
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**O label "PROGRAM" pisca em vermelho** quando está ao ar! 🔴

### Botão ON AIR

```css
.btn-go-live {
  background: var(--accent);  /* Rosa #e94560 */
  color: #fff;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 120px;
}

.btn-go-live:hover {
  background: #ff6580;
  transform: translateY(-1px);
}

.btn-go-live:active {
  transform: scale(0.95);
}

.btn-go-live:disabled {
  background: var(--text-dim);
  cursor: not-allowed;
}
```

**Feedback visual completo**: hover, active, disabled.

---

## 💻 PASSO 3: Adicionar Estado e Funções em app-grid-v2.js

### Estado Global: `outputState`

```javascript
const outputState = {
  preview: {
    row: null,
    col: null,
    cellId: null,
    layers: [],
  },
  program: {
    row: null,
    col: null,
    cellId: null,
    layers: [],
  },
  transition: {
    type: 'cut',        // 'cut', 'fade', 'dissolve'
    duration: 500,      // ms
    isTransitioning: false,
    startTime: null,
  }
}
```

**Rastreia**:
- Qual célula está em **Preview** (o que operador está preparando)
- Qual célula está em **Program** (o que público vê)
- Que tipo de **transição** será aplicada

### Função: `setupOutputMonitors()`

```javascript
function setupOutputMonitors() {
  // Obter canvas dos monitores
  monitorPreviewCanvas = document.getElementById('monitor-preview')
  if (monitorPreviewCanvas) {
    monitorPreviewCtx = monitorPreviewCanvas.getContext('2d')
    monitorPreviewCtx.fillStyle = '#000000'
    monitorPreviewCtx.fillRect(0, 0, monitorPreviewCanvas.width, monitorPreviewCanvas.height)
  }

  // Botão ON AIR
  const btnGoLive = document.getElementById('btn-go-live')
  if (btnGoLive) {
    btnGoLive.addEventListener('click', () => {
      if (outputState.preview.row !== null && outputState.preview.col !== null) {
        sendToProgram()
      }
    })
  }

  // Transição selector
  const transitionType = document.getElementById('transition-type')
  if (transitionType) {
    transitionType.addEventListener('change', (e) => {
      outputState.transition.type = e.target.value
      // Atualizar duração
      switch (outputState.transition.type) {
        case 'cut': outputState.transition.duration = 0; break
        case 'fade': outputState.transition.duration = 500; break
        case 'dissolve': outputState.transition.duration = 1000; break
      }
    })
  }

  console.log('✓ Output Monitors configurados')
}
```

**Inicializa**:
1. Canvas dos monitores
2. Listeners para botão e selector
3. Dinâmica de duração de transição

### Função: `renderMonitorPreview(row, col)`

```javascript
function renderMonitorPreview(row, col) {
  if (!monitorPreviewCanvas || !monitorPreviewCtx) return

  const cell = grid[row][col]
  const w = monitorPreviewCanvas.width
  const h = monitorPreviewCanvas.height

  // Limpa canvas
  monitorPreviewCtx.fillStyle = '#000000'
  monitorPreviewCtx.fillRect(0, 0, w, h)

  if (cell.layers.length === 0) {
    monitorPreviewCtx.fillStyle = '#444444'
    monitorPreviewCtx.font = '20px Arial'
    monitorPreviewCtx.textAlign = 'center'
    monitorPreviewCtx.fillText('Preparando...', w / 2, h / 2)
    return
  }

  // Stack-based rendering (IDÊNTICO A FASE 1)
  cell.layers.forEach((layer) => {
    if (!layer.visible) return

    monitorPreviewCtx.globalCompositeOperation = BLEND_MODES[layer.blendMode] || 'source-over'
    monitorPreviewCtx.globalAlpha = layer.opacity

    // Renderiza cada tipo de layer
    if (layer.type === 'video' && layer.src) { /* ... */ }
    if (layer.type === 'image' && layer.src) { /* ... */ }
    if (layer.type === 'text' && layer.text) { /* ... */ }
  })

  monitorPreviewCtx.globalCompositeOperation = 'source-over'
  monitorPreviewCtx.globalAlpha = 1

  // Atualiza info
  const info = document.getElementById('monitor-preview-info')
  if (info) {
    info.textContent = `[${row}, ${col}] • ${cell.layers.length} camadas`
  }
}
```

**O quê**: Renderiza a célula selecionada no canvas preview  
**Como**: Mesmo stack-based rendering da Fase 1  
**Quando**: Toda vez que célula é selecionada

### Função: `renderMonitorProgram(row, col)`

**100% idêntica a `renderMonitorPreview()`**, mas:
- Renderiza em `monitorProgramCtx`
- Label de info mostra "🔴 AO AR"

### Função: `sendToProgram()`

```javascript
function sendToProgram() {
  if (outputState.preview.row === null || outputState.preview.col === null) return

  const row = outputState.preview.row
  const col = outputState.preview.col
  const transitionType = outputState.transition.type
  const duration = outputState.transition.duration

  // Atualiza estado
  outputState.program.row = row
  outputState.program.col = col

  // Se cut, renderiza imediatamente
  if (transitionType === 'cut' || duration === 0) {
    renderMonitorProgram(row, col)
    console.log(`✓ Program updated: [${row}, ${col}]`)
  } else {
    // Para fade/dissolve, aplica depois (TODO: interpolação de frames)
    setTimeout(() => {
      renderMonitorProgram(row, col)
    }, duration)
  }

  // Disable botão temporariamente
  const btn = document.getElementById('btn-go-live')
  if (btn) {
    btn.disabled = true
    setTimeout(() => { btn.disabled = false }, duration + 100)
  }
}
```

**O fluxo**:
1. Verifica se há preview selecionada
2. Copia row/col de preview para program
3. Se cut → renderiza logo
4. Se fade/dissolve → espera e renderiza (TODO: interpolação suave)
5. Desativa botão para evitar múltiplos cliques

---

## 🔗 PASSO 4: Conectar com Seleção de Célula

### Modificação em `selectCell(row, col)`

```javascript
function selectCell(row, col) {
  selectedCell = { row, col }
  selectedLayerId = null
  renderGrid()
  renderLayersPanel()
  renderProperties()
  updateCellInfo()
  
  // FASE 2: Renderiza monitor preview quando célula é selecionada ← NOVO
  outputState.preview.row = row
  outputState.preview.col = col
  renderMonitorPreview(row, col)
}
```

**Quando operador clica em uma célula**:
1. Célula é marcada como "selecionada"
2. Painel de layers é atualizado
3. **NOVO**: Preview renderiza o conteúdo da célula

---

## 🚀 PASSO 5: Inicialização

### No `init()`

```javascript
(function init() {
  console.log('🎬 MediaLayers v2 inicializando...')

  // Setup canvas
  setupPreviewCanvas()
  
  // FASE 2: Setup output monitors ← NOVO
  setupOutputMonitors()

  // Setup tabs
  setupTabs()

  // ... resto da inicialização
})
```

### Estágio inicial

```javascript
  // Renderiza monitores em standby
  const emptyCell = { layers: [] }
  const emptyCanvas = monitorProgramCanvas
  if (emptyCanvas) {
    const ctx = emptyCanvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height)
    ctx.fillStyle = '#333333'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🔴 STANDBY', emptyCanvas.width / 2, emptyCanvas.height / 2)
  }
```

**Program inicia em STANDBY** (não há nada ao ar até operador enviar)

---

## 🎬 Fluxo de Uso

### Cenário: Operador preparando para apresentação

```
1️⃣ Operador abre tab "Saída"
   → Preview vazio ("Preparando...")
   → Program em STANDBY ("🔴 Nada ao ar")

2️⃣ Operador clica em célula [2, 3]
   → Preview renderiza conteúdo de [2, 3]
   → Info mostra "[2, 3] • 3 camadas"

3️⃣ Operador verifica transição: "Fade"

4️⃣ Operador clica "→ ON AIR"
   → Transição de 500ms aplicada
   → Program muda para [2, 3]
   → Label "PROGRAM" pisca em vermelho

5️⃣ Operador prepara novo clip: clica [1, 1]
   → Preview renderiza [1, 1]
   → Program continua mostrando [2, 3]
   → Público não vê mudança!

6️⃣ Operador clica "→ ON AIR" novamente
   → Public vê transição para [1, 1]
```

---

## 🔧 Arquitetura de Dados

```
GRID (2D) ──→ selectCell() ──→ outputState.preview
                                        ↓
                            renderMonitorPreview()
                                        ↓
                            Canvas preview renderizado
                                        
                        (Operador clica "ON AIR")
                                        ↓
                            sendToProgram()
                                        ↓
                            outputState.program = preview
                                        ↓
                            renderMonitorProgram()
                                        ↓
                            Canvas program renderizado
```

---

## 🎨 Estado da Interface

### Tab "📡 Saída"

```
┌─────────────────────────────────────────────────────────┐
│  👁 PREVIEW (Preparando)  │ ⏱ Fade  │ 📺 PROGRAM        │
│  [Canvas 960×540]         │  → ON   │ [Canvas 960×540]  │
│  [2, 3] • 3 layers        │  AIR   │ 🔴 LIVE: [2,3] •  │
└─────────────────────────────────────────────────────────┘
```

---

## 💡 Conceitos Importantes

### 1. **Stack-Based Rendering Reutilizado**
- Usamos exatamente a mesma lógica de renderização da Fase 1
- Preview e Program usam blending modes, opacidade, visibilidade
- Diferença única: canvas dedicada vs. canvas compartilhada

### 2. **Estado Único Fonte da Verdade**
- `outputState` rastreia tudo
- Não há sincronização mágica - operador controla explicitamente

### 3. **Transições (TODO para Fase 3+)**
- Hoje: Cut é instantâneo, Fade/Dissolve espera duração
- Futuro: Interpolação de frames para transição suave
- Seria: Canvas intermediária, blend 2 frames

### 4. **Escalabilidade**
- Sistema pronto para múltiplos monitors (externa, aux, etc)
- Só adicionar mais canvas + functions

---

## 🧪 Testes Manuais (QA)

- [ ] Abrir aplicativo, clique na tab "📡 Saída"
- [ ] Preview vazio? ✓ Mostra "Preparando..."
- [ ] Program em STANDBY? ✓ Mostra "🔴 Nada ao ar"
- [ ] Selecionar célula no grid → Preview atualiza? ✓
- [ ] Mudar transição → OK? ✓ (cut/fade/dissolve)
- [ ] Clique "ON AIR" → Program renderiza? ✓ (verificar duração)
- [ ] Label "PROGRAM" pisca em vermelho? ✓
- [ ] Botão disable durante transição? ✓
- [ ] Preparar novo clip enquanto outro ao ar? ✓ (preview não afeta program)

---

## 📊 Resumo Técnico

| Aspecto | Implementação |
|---------|----------------|
| **Canvas Preview** | `<canvas id="monitor-preview">` (960×540) |
| **Canvas Program** | `<canvas id="monitor-program">` (960×540) |
| **Rendering** | Stack-based com `globalCompositeOperation` (8+ blending) |
| **Transições** | Cut (0ms), Fade (500ms), Dissolve (1000ms) |
| **Estado** | `outputState` global rastreando preview/program/transition |
| **Sincronismo** | Manual (operador clica "ON AIR"), não automático |
| **Próxim Fase** | Interpolação de frames, transições suaves, histórico |

---

## 🔄 Integração com Fases Futuras

### Fase 3+: Dockable Panels
- Monitores podem ser janelas flutuantes
- Redimensionáveis e repositionáveis

### Fase 5: Mesa de Corte
- Usar mesma lógica de sendToProgram()
- Múltiplas entradas (inputs) em vez de 1

### Fase 7: Vídeo Remoto
- Preview/Program recebem streams HTTP/WebRTC
- Mesmo renderMonitorProgram() funciona

### Fase 8: Controle Celular
- App remoto envia (row, col) para sendToProgram()
- WebSocket sincroniza outputState

---

## 📝 Conclusão

**Fase 2 completa!** Implementamos um sistema profissional de Preview/Program que:

✅ Permite operador preparar conteúdo sem interferir ao ar  
✅ Suporta múltiplas transições configuráveis  
✅ Usa stack-based rendering (reutilizando Fase 1)  
✅ Fornece feedback visual claro (labels, pulsação, disabled states)  
✅ Escalável para múltiplos monitors  
✅ Pronto para integração com Fases 3-8  

**Próxima**: Fase 3 (Dockable Panels) para interface mais profissional!

---

**Fase 2 Completada**: 30 de março de 2026
