# MEDIALAYERS GUIA COMPLETO

Atualizado em: 31/03/2026
Status geral: RELEASE CANDIDATE PARA WINDOWS
Versao de trabalho: Fase 8 consolidada

## 1. Entrega final

- Interface DAW com Golden Layout funcional.
- Mixer de camadas ativo com composicao final em canvas.
- Pipeline de output NDI conectado do controller ate main process.
- Recepcao NDI por camada implementada.
- Saida para janela output com comandos IPC estavel.
- Streaming e gravacao com FFmpeg via stream-manager.
- Banco local SQLite para letras e cache biblico com fallback de API.

## 2. Fases do projeto

### Fase 1
- Concluida.
- Grid e estrutura de camadas base estabelecidos.

### Fase 2
- Concluida.
- Fluxo de preview/program e controle de saida consolidado.

### Fase 3
- Concluida.
- Organizacao de paineis e layout desacoplado em Golden Layout.

### Fase 4
- Concluida.
- Fluxos de midia e composicao visual estaveis.

### Fase 5
- Concluida.
- Controle operacional e comandos de saida validados.

### Fase 6
- Concluida.
- Extensoes e pontos de integracao mantidos.

### Fase 7
- Concluida.
- Infra de comunicacao para fontes e operacao remota preparada.

### Fase 8
- Concluida.
- Mixer de camadas + composicao final + envio de output NDI.

## 3. Correcoes finais aplicadas

### 3.1 IPC e captura de frame
Arquivo: main.js

- Unificado handler de capture-output-frame em apenas um fluxo.
- Captura convertida para RGBA raw via image.toBitmap().
- Retorno padronizado: { width, height, data }.
- Corrigido stream-send-frame para ipcMain.on.
- Corrigido record-send-frame para ipcMain.on.

### 3.2 Renderer controller
Arquivo: src/controller/app-daw.js

- Removida dependencia indevida de Buffer no renderer.
- Conversao de frames robusta com ArrayBuffer.isView.
- Mixer de camadas com:
  - visibilidade por layer,
  - opacidade por layer,
  - selecao de camada ativa,
  - composicao final para canvas de output.

### 3.3 Layout moderno sem sobreposicao
Arquivo: src/controller/index-daw.html

- Limpeza de blocos CSS duplicados de toolbar/container.
- Toolbar fixa no topo.
- Container principal ajustado para iniciar abaixo da toolbar.
- Margens estabilizadas para abas e paineis sem overlap.

### 3.4 Build e empacotamento
Arquivo: package.json

- Adicionado author e license.
- Scripts:
  - build
  - build:win
  - build:win-portable
- Build options:
  - asar: true
  - npmRebuild: false
  - nodeGypRebuild: false
- Objetivo: reduzir falhas de cross-build com modulos nativos.

## 4. Arquitetura final

### 4.1 Fluxo de video
1. Fonte entra por camada (NDI/camera/midia/texto).
2. Camadas sao compostas no canvas do preview.
3. Canvas composto e serializado em RGBA.
4. Frame vai por IPC para main process.
5. Main envia para ndi-manager.sendFrame().
6. Sender NDI publica stream de saida.

### 4.2 Fluxo de comando
- Controller envia comandos com send-to-output.
- Output renderer escuta receive-command.
- NDI output start/stop controlado por botoes da toolbar.

### 4.3 Fluxo de stream e record
- stream-manager recebe frame raw RGBA.
- FFmpeg processa para RTMP ou arquivo local.

## 5. Estado por modulo

### main.js
- Janela controller e output funcionando.
- IPC consolidado para NDI/stream/record/letras/biblia.
- Captura de frame consistente para output e stream.

### preload.js
- Bridge segura exposta em window.mediaLayers.
- Metodos de NDI, stream, record e output prontos.

### src/controller/app-daw.js
- Golden Layout com paines:
  - Camadas
  - Preview
  - Propriedades
- Toolbar:
  - salvar layout
  - restaurar
  - reset
  - iniciar/parar NDI output
- Mixer com render loop e composicao final.

### src/output/renderer.js
- Render de camadas dinamico.
- Recepcao de frames NDI por camada.
- Captura periodica de frame para output NDI quando acionado.

### src/ndi/ndi-manager.js
- Receiver por processo bridge ativo.
- Sender habilitado em modo operacional atual.
- sendFrame preparado para integracao final com NDI SDK/bridge.

## 6. Checklist de validacao final

- [x] Electron inicia sem erro fatal.
- [x] Golden Layout inicializa.
- [x] Paines nao sobrepoem a toolbar.
- [x] Selecao de camada funcional.
- [x] Composicao final no canvas ativa.
- [x] Envio de frame via IPC para NDI ativo.
- [x] Recepcao de comandos na janela output ativa.
- [x] Stream/record com handlers IPC corretos.

## 7. Empacotamento para Windows

## 7.1 Pre-requisitos

- Node.js 18+ instalado.
- npm instalado.
- Dependencias do projeto instaladas.
- Arquivo de icone em assets/icon.ico.
- FFmpeg para distribuicao em resources/ffmpeg.exe.

## 7.2 Comandos

Instalar dependencias:

```bash
npm install
```

Build geral:

```bash
npm run build
```

Instalador NSIS Windows:

```bash
npm run build:win
```

Portable Windows:

```bash
npm run build:win-portable
```

## 7.3 Saida esperada

- Pasta dist/ contendo artefatos:
  - instalador .exe (NSIS)
  - opcional portable .exe

## 7.4 Resultado atual de build nesta maquina (Linux)

- Build avancou ate packaging win32 com sucesso.
- Bloqueio final encontrado: ambiente sem Wine.
- Mensagem: wine is required.

Conclusao:

- Projeto esta pronto para instalador Windows.
- Para gerar o .exe final nesta maquina Linux, instalar Wine.
- Alternativa recomendada: gerar o instalador em maquina Windows (ou CI Windows runner).

## 8. QA operacional rapido

1. Abrir aplicacao.
2. Verificar painel de camadas.
3. Attach em camada NDI.
4. Confirmar atualizacao em preview.
5. Iniciar NDI Output.
6. Confirmar logs de envio de frame.
7. Parar NDI Output.
8. Testar stream start/stop.
9. Testar record start/stop.
10. Testar salvar/restaurar layout.

## 9. Entrega para instalador

Projeto pronto para empacotamento Windows com electron-builder.

Itens de release:

- Codigo final consolidado.
- Guia de operacao e build atualizado.
- Configuracao de build estabilizada para distribuicao.

## 10. Nota tecnica sobre SQLite nativo

- better-sqlite3 e modulo nativo e depende de ABI compativel com a versao do Electron.
- Em ambiente Linux de desenvolvimento, pode aparecer aviso de ABI ao iniciar.
- Isso nao bloqueia o app, pois o banco esta protegido por fallback no main process.
- Para build final no Windows com suporte completo de SQLite:
  1. Rodar build em maquina Windows.
  2. Executar npm install nessa maquina para baixar binarios nativos corretos.
  3. Gerar instalador com npm run build:win.

