# 🎮 Conceito do Grid: Linhas (Y) × Colunas (X)

## 📊 Visualização: Batalha Naval

### O Grid é Como Batalha Naval:

```
     COL 0   COL 1   COL 2   COL 3   COL 4   COL 5
     (X=0)   (X=1)   (X=2)   (X=3)   (X=4)   (X=5)
      ↑       ↑       ↑       ↑       ↑       ↑
    ╔════════╦════════╦════════╦════════╦════════╦════════╗
    ║        ║        ║        ║        ║        ║        ║ ROW 0 (Y=0)
    ║ (0,0)  ║ (0,1)  ║ (0,2)  ║ (0,3)  ║ (0,4)  ║ (0,5)  ║
    ╠════════╬════════╬════════╬════════╬════════╬════════╣
    ║        ║        ║        ║        ║        ║        ║ ROW 1 (Y=1)
    ║ (1,0)  ║ (1,1)  ║ (1,2)  ║ (1,3)  ║ (1,4)  ║ (1,5)  ║
    ╠════════╬════════╬════════╬════════╬════════╬════════╣
    ║        ║        ║        ║        ║        ║        ║ ROW 2 (Y=2)
    ║ (2,0)  ║ (2,1)  ║ (2,2)  ║ (2,3)  ║ (2,4)  ║ (2,5)  ║
    ╠════════╬════════╬════════╬════════╬════════╬════════╣
    ║        ║        ║        ║        ║        ║        ║ ROW 3 (Y=3)
    ║ (3,0)  ║ (3,1)  ║ (3,2)  ║ (3,3)  ║ (3,4)  ║ (3,5)  ║
    ╚════════╩════════╩════════╩════════╩════════╩════════╝
     ↑       ↑       ↑       ↑       ↑       ↑
     COLUNAS AUMENTAM → (esquerda para direita)
     
LINHAS AUMENTAM ↓ (cima para baixo)
```

---

## 📍 Anatomia de uma Célula

### Cada célula `grid[row][col]` contém **LAYERS** (mídias uma em cima da outra):

```
CÉLULA (2, 3):
┌──────────────────────────┐
│ LAYER 3 (Topo)           │  ← Texto "Bem-vindo"
│ ┌────────────────────┐   │
│ │ LAYER 2 (Meio)     │   │  ← Imagem PNG com opacity 0.7
│ │ ┌────────────────┐ │   │
│ │ │ LAYER 1 (Fundo)│ │   │  ← Vídeo rodando
│ │ └────────────────┘ │   │
│ └────────────────────┘   │
└──────────────────────────┘

RENDERIZAÇÃO (stack):
1. Limpar canvas (fundo preto)
2. Renderizar LAYER 1 (vídeo) com blend mode + opacity
3. Renderizar LAYER 2 (imagem) com blend mode + opacityi
4. Renderizar LAYER 3 (texto) com blend mode + opacity
= Resultado final composto
```

---

## 🧮 Eixos no Sistema

### X-Axis (Horizontal = Colunas)
```
    X=0  X=1  X=2  X=3  X=4  X=5
     ←─────────────────────────→
     
Aumentar X = IR PARA DIREITA
Diminuir X = IR PARA ESQUERDA
```

### Y-Axis (Vertical = Linhas)
```
     ↓ Y=0
     ↓ Y=1
     ↓ Y=2
     ↓ Y=3
     
Aumentar Y = IR PARA BAIXO
Diminuir Y = IR PARA CIMA
```

---

## 🎯 Coordenadas: `grid[Y][X]` ou `grid[row][col]`

### Exemplos:

| Notação | Significado | Posição |
|---------|------------|---------|
| `grid[0][0]` | Linha 0 (Y=0), Coluna 0 (X=0) | Canto superior esquerdo |
| `grid[0][5]` | Linha 0 (Y=0), Coluna 5 (X=5) | Canto superior direito |
| `grid[3][0]` | Linha 3 (Y=3), Coluna 0 (X=0) | Canto inferior esquerdo |
| `grid[3][5]` | Linha 3 (Y=3), Coluna 5 (X=5) | Canto inferior direito |
| `grid[2][3]` | Linha 2 (Y=2), Coluna 3 (X=3) | Meio do grid (4×6) |

---

## 🎬 Estrutura de Dados

```javascript
// GRID GLOBAL
const grid = [
  // ROW 0 (Y=0)
  [
    { layers: [...] },    // (0,0): Célula coluna 0
    { layers: [...] },    // (0,1): Célula coluna 1
    { layers: [...] },    // (0,2): Célula coluna 2
    { layers: [...] },    // (0,3): Célula coluna 3
    { layers: [...] },    // (0,4): Célula coluna 4
    { layers: [...] }     // (0,5): Célula coluna 5
  ],
  // ROW 1 (Y=1)
  [
    { layers: [...] },    // (1,0)
    { layers: [...] },    // (1,1)
    // ... etc
  ],
  // ... mais linhas
]

// CADA layer CONTÉM:
{
  id: 1,
  type: 'video',           // 'video', 'image', 'text', 'audio', 'camera'
  name: 'Apresentação.mp4',
  src: 'blob:...',         // caminho do arquivo
  opacity: 0.8,            // 0 a 1
  visible: true,
  blendMode: 'screen',     // normal, multiply, screen, overlay, add, etc
  // ... propriedades específicas por tipo
}
```

---

## ⌨️ Controles para Modificar o Grid

### No Header (Topo da Interface):

```
Y (Linhas):  [−] [4] [+]
X (Colunas): [−] [6] [+]

[Resetar]  [Limpar Tudo]
```

### Funções:

| Botão | Função | Resultado |
|-------|--------|-----------|
| `−` (Y) | `removeRow()` | Diminui linhas (Y-1) |
| `+` (Y) | `addRow()` | Aumenta linhas (Y+1) |
| `−` (X) | `removeColumn()` | Diminui colunas (X-1) |
| `+` (X) | `addColumn()` | Aumenta colunas (X+1) |
| `Resetar` | `resetGrid()` | Volta para 4×6 |
| `Limpar Tudo` | `clearAll()` | Deleta todas as layers |

---

## 🔢 Um Grid 4×6 tem então:

```
4 LINHAS (Y=0 a Y=3):
├─ Linha 0: células (0,0) até (0,5)
├─ Linha 1: células (1,0) até (1,5)
├─ Linha 2: células (2,0) até (2,5)
└─ Linha 3: células (3,0) até (3,5)

6 COLUNAS (X=0 a X=5):
├─ Coluna 0: células (0,0), (1,0), (2,0), (3,0)
├─ Coluna 1: células (0,1), (1,1), (2,1), (3,1)
├─ Coluna 2: células (0,2), (1,2), (2,2), (3,2)
├─ Coluna 3: células (0,3), (1,3), (2,3), (3,3)
├─ Coluna 4: células (0,4), (1,4), (2,4), (3,4)
└─ Coluna 5: células (0,5), (1,5), (2,5), (3,5)

TOTAL: 4 × 6 = 24 células
```

---

## 📐 Comportamento de Adicionar/Remover

### Adicionar Linha (Y+1):

```
ANTES (4×6):              DEPOIS (5×6):
Row 0: [6 células]        Row 0: [6 células]
Row 1: [6 células]        Row 1: [6 células]
Row 2: [6 células]  →     Row 2: [6 células]
Row 3: [6 células]        Row 3: [6 células]
                          Row 4: [6 células vazias] ← NOVA

Resultado: 24 → 30 células
```

### Adicionar Coluna (X+1):

```
ANTES (4×6):              DEPOIS (4×7):
┌─┬─┬─┬─┬─┬─┐            ┌─┬─┬─┬─┬─┬─┬─┐
├─┼─┼─┼─┼─┼─┤            ├─┼─┼─┼─┼─┼─┼─┤
├─┼─┼─┼─┼─┼─┤     →      ├─┼─┼─┼─┼─┼─┼─┤
├─┼─┼─┼─┼─┼─┤            ├─┼─┼─┼─┼─┼─┼─┤
└─┴─┴─┴─┴─┴─┘            └─┴─┴─┴─┴─┴─┴─┘
  ↑ nova coluna vazia

Resultado: 24 → 28 células
```

### Remover Linha (Y-1):

```
ANTES (4×6):              DEPOIS (3×6):
Row 0: [6 células]        Row 0: [6 células]
Row 1: [6 células]  →     Row 1: [6 células]
Row 2: [6 células]        Row 2: [6 células]
Row 3: [6 células] ✗      (deletada)

⚠️ ATENÇÃO: Todas as layers em Row 3 são perdidas!

Resultado: 24 → 18 células
```

---

## 🎓 Fluxo de Uso Típico

### Cenário: Preparar apresentação religiosa com 3 seções

```
1️⃣ SETUP INICIAL
   Clico em: [−] [4] [+] para Y (deixo em 4 linhas)
   Clico em: [−] [6] [+] para X (deixo em 6 colunas)
   Grid 4×6 = 24 slots para mídia
   
2️⃣ PREENCHENDO CONTEÚDO
   
   Y(Linhas)         X(Colunas)
   ─────────────────────────────────────────
   Linha 0: [Intro video] [Logo] [Fundo] [-] [-] [-]
   Linha 1: [Música] [Bíblia] [Hino] [Letra] [Chat] [Hora]
   Linha 2: [Pregação v1] [Pregação v2] [Testemunho] [-] [-] [-]
   Linha 3: [Encerramento] [Créditos] [-] [-] [-] [-]
   
3️⃣ OPERADOR SELECIONA CÉLULA
   Clica em (1, 1) = Linha 1, Coluna 1 = "Bíblia"
   → Preview renderiza versículos da Bíblia
   
4️⃣ OPERADOR ENVIA PARA PROGRAM
   Clica "→ ON AIR"
   → Público vê conteúdo de (1, 1)
   
5️⃣ PREPARAR PRÓXIMO
   Clica em (2, 0) = "Pregação v1"
   → Preview renderiza, programa continua em (1, 1)
   
6️⃣ ENVIAR PRÓXIMO
   Clica "→ ON AIR" novamente
   → Transição suave, público vê (2, 0)
```

---

## 🚀 Como Funciona no Código

### Ao clicar em célula `(2, 3)`:

```javascript
selectCell(2, 3)
  ↓
grid[2][3].layers         // Array de layers nessa célula
  ↓
renderMonitorPreview(2, 3)  // Renderiza todas as layers
  ↓
Canvas mostra conteúdo de (2, 3)
```

### Ao enviar para PROGRAM:

```javascript
sendToProgram()
  ↓
outputState.program.row = preview.row   // 2
outputState.program.col = preview.col   // 3
  ↓
renderMonitorProgram(2, 3)
  ↓
Canvas PROGRAM renderiza (2, 3)
  ↓
Público vê resultado final
```

---

## 📝 Resumo

| Conceito | Significado |
|----------|------------|
| **Y (Linhas)** | Eixo vertical (cima ↔ baixo) |
| **X (Colunas)** | Eixo horizontal (esquerda ↔ direita) |
| **`grid[Y][X]`** | Célula em posição Y,X |
| **Célula** | Contém `layers[]` (mídias empilhadas) |
| **Layer** | Uma mídia (vídeo, imagem, texto, áudio, câmera) |
| **Stack Rendering** | Renderizar layers de baixo → cima (compositing) |
| **Botões +/-** | Adicionar/remover linhas ou colunas dinamicamente |

---

## ✅ Grid Agora Suporta:

- ✅ Visualização clara de Y (linhas) × X (colunas)
- ✅ Adicionar linhas com botão `+` (Y)
- ✅ Remover linhas com botão `−` (Y)
- ✅ Adicionar colunas com botão `+` (X)
- ✅ Remover colunas com botão `−` (X)
- ✅ Resetar para 4×6 padrão
- ✅ Limpar todas as layers
- ✅ Cada célula contém múltiplas layers (stack)
- ✅ Preview/Program sincronizado com células

---

**Pronto para trabalhar com o Grid! 🎮**
