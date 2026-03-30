# 🎬 MediaLayers - Guia Rápido Fase 1 v2

## 🚀 Como Começar AGORA

### 1️⃣ Escolha qual versão abrir:

**Opção A: GridV2 (Recomendado - Novo!)**
```bash
# Abra o arquivo:
src/controller/index-v2.html
```

**Opção B: V1 Colunas (Antigo - Referência)**
```bash
# Ou o arquivo:
src/controller/index.html
```

### 2️⃣ Configurar grid

```
Input do header:
┌──────────┐  ┌──────────┐
│ 4 linhas │ × │ 6 colunas │
└──────────┘  └──────────┘

Clique: "Atualizar Grid"
```

### 3️⃣ Usar a interface

```
┌─────────────────────────────────────────────────┐
│ GRID (tab ativa)                                │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┐         │
│ │ 📭  │ 📭  │ 📭  │ 📭  │ 📭  │ 📭  │         │
│ └─────┴─────┴─────┴─────┴─────┴─────┘         │
│ ...                                             │
│                                                 │
│ [Clique] = Seleciona célula                    │
│ [Duplo clique] = Dispara/Visualiza             │
└─────────────────────────────────────────────────┘

PAINEL ESQUERDO:      PAINEL DIREITO:
• Célula selecionada  • Opacidade
• Camadas             • Blending mode
• Botões (🎥🖼📝etc) • Cor/Tamanho
```

### 4️⃣ Você está pronto! 🎉

---

## 📖 Documentação Completa

Leia na **ordem recomendada**:

1. **🎬 [ARQUITETURA_V2_COMPLETA.md](ARQUITETURA_V2_COMPLETA.md)** ← COMECE AQUI
   - O que é grid?
   - Stack-based rendering
   - Blending modes
   - Como funciona tudo

2. **🔄 [TRANSICAO_V1_V2.md](TRANSICAO_V1_V2.md)**
   - Comparação v1 vs v2
   - Diagramas visuais
   - Performance
   - Roadmap

3. **📝 [app-grid-v2.js](src/controller/app-grid-v2.js)**
   - Código comentado (1000+ linhas)
   - Funções principais documentadas

4. **🎨 [style-v2.css](src/controller/style-v2.css)**
   - Layout 3-painéis
   - Grid responsivo
   - Scroll obrigatório

---

## 🎯 O que você pode fazer AGORA

✅ Criar um grid 4×6 (até 12×12)
✅ Adicionar múltiplas layers por célula
✅ Ajustar opacidade de cada layer
✅ Aplicar blending modes (multiply, screen, overlay, etc)
✅ Preview em tempo real com canvas
✅ Disparar células para visualizar resultado
✅ Organizar layers como uma pilha (stack)
✅ Scroll em tudo que ultrapassar limite

---

## 🔮 Próximas Fases (Roadmap)

**Fase 2: Preview Funcional**
- Sincronizar grid com janela de saída
- Real-time rendering

**Fase 3: Drag & Drop**
- Arrastar mídia pro grid
- Reordenar layers com mouse

**Fase 4: Saída Profissional**
- Multi-monitor support
- Timeline/sequencer

**Fase 5: Extras VJ**
- WebRTC video remoto
- Controle via celular
- Efeitos e distorções

---

## 💡 Conceitos-Chave

### Grid é uma Matriz 2D
```javascript
grid[row][col].layers[index]
```

### Stack = Ordem Importa
```
layers[0] = renderizado PRIMEIRO (atrás)
layers[n] = renderizado ÚLTIMO (frente)
```

### Blending Modes Mudam Resultado
```
multiply = escurece
screen = clareia
overlay = contraste
add = aditivo (brilho)
```

### Canvas = Rápido & Profissional
```
Renderização real-time sem lag
Até 144 clips em um grid 12×12
```

---

## 📊 Estrutura de Dados

```javascript
// GRID
grid = [
  [
    { layers: [...], isPlaying: false },  // [0][0]
    { layers: [...], isPlaying: false },  // [0][1]
  ],
  [
    { layers: [...], isPlaying: false },  // [1][0]
  ]
]

// LAYER
{
  id: 1001,
  type: 'video',
  name: 'Background.mp4',
  src: 'blob:...',
  opacity: 0.8,
  visible: true,
  blendMode: 'multiply',  // ← NOVO!
  // ... props extras
}
```

---

## 🛠️ Atalhos & Comandos

| Ação | Como fazer |
|------|-----------|
| Selecionar célula | Clique normal |
| Disparar/Visualizar | Duplo clique |
| Adicionar vídeo | Clique botão 🎥 |
| Adicionar imagem | Clique botão 🖼 |
| Adicionar texto | Clique botão 📝 |
| Mudar blend mode | Dropdown à direita |
| Ajustar opacidade | Slider à direita |
| Mudar tamanho grid | Input header + botão |
| Limpar tudo | Botão ⬛ Limpar |

---

## ❓ FAQ

**P: Quantos clips posso ter?**
R: Até 12×12 = 144 clips. Cada um com N layers.

**P: Posso reordenar layers?**
R: Fase 3 (drag & drop). Por enquanto, delete e re-adicione.

**P: Que tipos de mídia são suportados?**
R: Video, Imagem, Áudio, Texto, Câmera (fase 2).

**P: O preview é em tempo real?**
R: Sim! Canvas renderiza cada mudança instantaneamente.

**P: Funciona em celular?**
R: O controle não, mas o output será remoto (fase 5).

---

## 📞 Troubleshooting

**"Grid não carregou"**
- Verificar DevTools (F12)
- Scroll down para ver se há grid
- Canvas pode estar pequeno

**"Layers não aparecem no preview"**
- Célula possui layers? (vê na esquerda)
- Layers estão visíveis? (clique 👁/🚫)
- Backgrounds/opacidade esconde? (ajuste props)

**"Blending mode não funciona"**
- Normal = suportado
- Multiply = suportado
- Screen = suportado
- Outros = podem precisar ajustes (bug report!)

---

## 📚 Arquivos Importantes

```
VOCÊ ESTÁ AQUI (README):
├── src/controller/
│   ├── index-v2.html (Nova interface)
│   ├── style-v2.css (Estilos)
│   └── app-grid-v2.js (Lógica - 1000+ linhas)
│
├── ARQUITETURA_V2_COMPLETA.md (Técnico - LEIA!)
├── TRANSICAO_V1_V2.md (Comparação v1 vs v2)
│
├── assets/
│   └── icon.ico (Ícone do app)
│
└── package.json (Dependências)
```

---

## 🎓 Para Aprender Mais

1. Leia **ARQUITETURA_V2_COMPLETA.md**
2. Explore **app-grid-v2.js** no editor
3. Observe **style-v2.css** para layout
4. Teste a interface
5. Experimente diferentes blending modes
6. Combine camadas criativas

---

## 🚀 Próximo Passo

Depois dessa Fase 1 v2, podemos fazer:

**Fase 2: Preview Funcional**
- Conectar grid com janela de output
- Sincronizar em tempo real
- Multi-monitor support

Quer que eu comece? 

---

**Última atualização**: 30 de março de 2026
**Versão**: MediaLayers v2.0 - Grid + Layers + Blending
**Status**: ✅ Fase 1 Completa

