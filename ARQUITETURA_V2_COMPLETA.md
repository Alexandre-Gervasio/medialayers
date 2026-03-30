# 🎬 MediaLayers v2: Grid + Layers + Blending Modes

## 📖 Visão Geral

A versão 2 é um **rewrite completo** inspirado em:
- **Ableton Live** (grid de clips, disparo de cenas)
- **Resolume Arena** (composição visual em tempo real)
- **Nuke/After Effects** (stack-based rendering, blending modes)

### Conceito Principal: "Matriz Interativa de Composições"

```
┌─────────────────────────────────────────────────────────┐
│ Grid 4×6 = 24 "Shots" (Composições)                    │
├─────────────────────────────────────────────────────────┤
│
│ [Clip 0,0]  [Clip 0,1]  [Clip 0,2]  ...
│ • Vídeo 1   • Imagem 1  • Câmera 1
│ • Texto 1   • Overlay   • Texto 2
│ • FX        
│
│ [Clip 1,0]  [Clip 1,1]  [Clip 1,2]  ...
│ • Vídeo 2   • Vídeo 3   • Áudio 1
│
│ ...
│
│ [Clip 3,5]  
│ • Texto 3
│
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitetura de Dados

### Estado Global

```javascript
// GRID: Matriz 2D de células
let grid = [
  [
    { layers: [Layer, Layer, ...], isPlaying: false },  // [0][0]
    { layers: [Layer], isPlaying: false },               // [0][1]
    ...
  ],
  [
    { layers: [Layer, Layer, ...], isPlaying: false },  // [1][0]
    ...
  ],
  // ... (4 linhas × 6 colunas)
]

// SELEÇÃO
let selectedCell = { row: 0, col: 0 }  // Qual célula está selecionada?
let selectedLayerId = 1001             // Qual layer dentro da célula?
```

### Estrutura de uma Camada (Layer)

```javascript
{
  id: 1001,                    // Identificador único
  type: 'video',               // 'video' | 'image' | 'text' | 'audio' | 'camera'
  name: 'Background.mp4',
  src: 'blob:...',             // URL do arquivo
  
  // Propriedades visuais
  opacity: 0.8,                // 0.0 a 1.0
  visible: true,               // Renderizado?
  blendMode: 'multiply',       // Modo de mistura
  
  // Props por tipo
  text: 'Hello World',         // Se type === 'text'
  fontSize: 48,
  fontColor: '#ffffff',
  fontBg: 'rgba(0,0,0,0.5)',
  
  // Props de mídia
  loop: true,                  // Se type === 'video'
  volume: 0.8,
}
```

---

## 🎨 Sistema de Layers com Stack-Based Rendering

### Conceito: Pilha de Transparência

Na renderização traditional em UIs, elementos são simplesmente colocados um sobre o outro. Aqui usamos **stack-based rendering** (similar ao compositing em VFX):

```
     ┌─────────────────┐
     │ Layer 3 (Texto) │  ← Renderizado por último (topo)
     ├─────────────────┤
     │ Layer 2 (FX)    │  ← Aplicado sobre Layer 1
     ├─────────────────┤
     │ Layer 1 (Vídeo) │  ← Base (renderizado primeiro)
     └─────────────────┘
```

### Função: `renderPreview(row, col)`

```javascript
function renderPreview(row, col) {
  // 1. Limpa canvas (fundo preto)
  canvas.fillStyle = '#000000'
  canvas.fillRect(0, 0, width, height)

  // 2. Pega a célula selecionada
  const cell = grid[row][col]

  // 3. Renderiza CADA layer em ordem (de trás para frente)
  cell.layers.forEach((layer) => {
    // Pula se invisível
    if (!layer.visible) return

    // Aplica modo de mistura
    canvas.globalCompositeOperation = BLEND_MODES[layer.blendMode]

    // Aplica opacidade
    canvas.globalAlpha = layer.opacity

    // Renderiza conteúdo
    if (layer.type === 'image') {
      canvas.drawImage(imageElement, 0, 0)
    }
    if (layer.type === 'text') {
      canvas.fillStyle = layer.fontColor
      canvas.fillText(layer.text, x, y)
    }
    // ...
  })
}
```

**Importante**: A ordem é **CRÍTICA**. Layers aparecem na mesma ordem que no array:
- `layers[0]` = primeiro renderizado (fundo)
- `layers[n]` = último renderizado (frente)

---

## 🎭 Blending Modes (Modos de Mistura)

Cada layer pode aplicar um modo de composição diferente:

```javascript
const BLEND_MODES = {
  'normal': 'multiply',         // Padrão (sobrescreve)
  'multiply': 'multiply',       // ✕ Escurece (multiplicação)
  'screen': 'screen',           // ⊕ Clareia (adição inversa)
  'overlay': 'overlay',         // ⊗ Contraste
  'add': 'lighter',             // Aditivo puro (brilho total)
  'subtract': 'darken',         // Subtrai cores
  'lighten': 'lighten',         // Apenas valores mais claros
  'darken': 'darken',           // Apenas valores mais escuros
}
```

### Exemplos de Uso

**Vídeo + Overlay com Multiply**:
```
Vídeo (Background)
     ↓
Imagem com blendMode='multiply'
     ↓ (Resulta em uma composição escurecida)
Texto com blendMode='screen'
     ↓ (Texto fica brilhante sobre fundo escuro)
```

---

## 📊 Interface & Layout

### 3 Painéis Principais

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Grid size (4×6), Atualizar, Limpar                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ESQUERDA        CENTRO                      DIREITA        │
│  (280px)         (flex 1fr)                  (260px)       │
│  ─────────────   ───────────────────────     ──────────    │
│  │  Célula      │  🔲 Grid Tab        │  │ Props Panel   │
│  │  [0,0]       │  👁 Preview Tab     │  │              │
│  │              │                     │  │ • Opacidade  │
│  │  Camadas:    │ [Grid visual]       │  │ • Blend Mode │
│  │  • 🎥 Video  │ [com scroll]        │  │ • Cor        │
│  │  • 🖼 Imagem │                     │  │              │
│  │  • 📝 Texto  │ [Preview canvas]    │  │              │
│  │              │ [com scroll]        │  │              │
│  │ ➕ Buttons   │                     │  │              │
│  └─────────────┘ └─────────────────────┘  └──────────────┘
│
│  ... (todo scrollável com barras obrigatórias)
└─────────────────────────────────────────────────────────────┘
```

### Responsividade & Scroll

- **Grid Container**: `overflow-x: auto; overflow-y: auto;` → Scroll se grid 4×12 não cabe
- **Layers Panel**: `overflow-y: auto;` → Scroll se muitas camadas
- **Properties Panel**: `overflow-y: auto;` → Scroll se muitas props
- **Preview Canvas**: Escala responsivamente mantendo 16:9

**CSS Garante Scroll Obrigatório**:
```css
.clips-grid {
  overflow: auto;
  scrollbar-width: auto;  /* Firefox */
  /* Chrome mostra scroll automaticamente se necessário */
}
```

---

## ⚙️ Fluxo de Interação

### 1. Usuário seleciona célula
```
Clica em [cell 1, 3]
  ↓
selectCell(1, 3)
  ↓
selectedCell = {row: 1, col: 3}
  ↓
renderGrid() ← destaca célula
renderLayersPanel() ← mostra layers da célula
renderProperties() ← mostra props
updateCellInfo() ← atualiza label
```

### 2. Usuário duplo-clica para disparar célula
```
Double-click em [cell 1, 3]
  ↓
triggerCell(1, 3)
  ↓
grid[1][3].isPlaying = true
renderPreview(1, 3) ← renderiza canvas
renderGrid() ← célula fica com borda verde "playing"
  ↓ (timeout 2s)
grid[1][3].isPlaying = false
```

### 3. Usuário adiciona layer à célula
```
Clica botão 🎥 (vídeo)
  ↓
addMediaLayer('video', fileInputId)
  ↓
Abre file picker
  ↓
Seleciona arquivo
  ↓
const layer = createLayer('video', name, blobUrl)
grid[row][col].layers.push(layer)
  ↓
selectLayer(layer.id)
renderLayersPanel() ← mostra novo layer
renderPreview() ← visualiza no canvas com stack rendering
```

### 4. Usuário ajusta blending mode
```
Muda select de blend mode para 'multiply'
  ↓
layer.blendMode = 'multiply'
  ↓
renderPreview() ← reaprenda canvas com novo blending
  ↓
Canvas mostra resultado visual imediatamente
```

---

## 🎯 Diferenciais da v2

| Aspecto | v1 (Colunas) | v2 (Grid) |
|---------|-------------|-----------|
| **Estrutura** | Colunas simples | Matriz 2D configurável |
| **Layers** | N camadas por coluna | N camadas por célula |
| **Renderização** | DOM simples | Canvas + compositing |
| **Blending** | Sem suporte | ✅ 8+ modos |
| **Interação** | Clique = seleciona | Clique = seleciona, Duplo = dispara |
| **Escalabilidade** | 4 colunas max | Até 12×12 (144 clips) |
| **Performance** | DOM heavy | Canvas optimizado |
| **UX** | Tradicional | Professional VJ/Live |

---

## 📈 Roadmap Técnico

### Fase 2 (Preview Funcional) ✅ FEITO
- Canvas rendering com stack layers
- Real-time preview com blending modes

### Fase 3 (Drag & Drop)
- Arrastar mídia diretamente na célula
- Reordenar layers com mouse

### Fase 4 (Saída)
- Renderizar célula para janela de output
- Sincronizar com displays múltiplos

### Fase 5 (Avançado)
- Timeline/sequencer para automatizar disparos
- Efeitos (blur, distortion, etc)
- Vídeo remoto (WebRTC)
- Controle via celular

---

## 🚀 Para Começar

1. Alterar `index.html` para carregar `index-v2.html`
2. Ou abre `index-v2.html` diretamente
3. Cria um grid 4×6
4. Seleciona uma célula
5. Adiciona camadas (vídeo, imagem, texto)
6. Ajusta opacidade e blending modes
7. Duplo-clica para disparar/visualizar

---

## 🛠️ Arquivos da v2

- `index-v2.html` - Nova interface
- `style-v2.css` - Estilos com grid responsivo
- `app-grid-v2.js` - Lógica completa (1000+ linhas)

---

## 📚 Conceitos-Chave para Não Esquecer

1. **Grid é uma MATRIZ**, não uma lista
   - Acesso: `grid[row][col]`
   - Sempre verificar bounds

2. **Stack-based rendering = ordem importa**
   - Primeira layer = fundo
   - Última layer = frente

3. **Blending modes mudam resultado visual**
   - `globalCompositeOperation` do canvas é a mágica
   - Cada layer pode ter blending diferente

4. **Scroll é OBRIGATÓRIO**
   - Sempre `overflow: auto` em containers com conteúdo dinâmico
   - Usuário NUNCA pode perder dados por serem "hidden"

5. **Canvas é STATELESS**
   - Redraw completo a cada frame
   - Sem "sprites" ou particles - tudo é renderizado fresh

