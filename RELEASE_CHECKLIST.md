# MediaLayers Release Checklist

## 1. Preparacao do ambiente

1. Node.js 22.x instalado
2. npm disponivel no PATH
3. Docker instalado (para build Windows sem shell interativo)
4. Dependencias instaladas:

```bash
npm ci --include=optional
```

## 2. Smoke test automatico

Executa validacoes basicas de sintaxe, API NDI, servidor WebRTC e wiring do controle remoto.

```bash
npm run ci:smoke
```

## 3. Build do instalador Windows

### Opcao A: Build local via Docker (Linux)

```bash
npm run build:win:docker
```

### Opcao B: Build via GitHub Actions CI

1. Push para branch main ou tag v*
2. Workflow: build-windows
3. Baixar artifacts gerados (dist/*.exe, dist/*.yml)

### Publicacao final no GitHub Releases

1. Atualizar a versao em package.json
2. Criar tag no formato vX.Y.Z
3. Executar:

```bash
git add .
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

4. Confirmar a release em:

```text
https://github.com/Alexandre-Gervasio/medialayers/releases/tag/vX.Y.Z
```

## 4. Checklist de release automatizado

Executa smoke test e valida artefatos de release na pasta dist.

```bash
npm run release:check
```

## 5. Testes manuais obrigatorios

### 5.1 Instalador Windows

1. Instalar o .exe em uma maquina Windows limpa
2. Abrir o app e validar inicializacao da janela Controller
3. Validar abertura da janela Output

### 5.2 NDI

1. Adicionar camada NDI na interface
2. Selecionar fonte NDI disponivel
3. Iniciar NDI Output
4. Validar recebimento do feed em receptor NDI externo

### 5.3 Controle remoto (mobile)

1. Abrir no celular: http://IP_DA_MAQUINA:3900
2. Validar botao TAKE
3. Validar botao CLEAR
4. Validar botoes PREV/NEXT

### 5.4 Smoke visual rapido

1. Drag and drop de imagem, video e audio
2. Fluxo Preview/Program com Cut e Take
3. Mudanca de layout dockable e persistencia (Salvar/Restaurar)
4. Plugins Texto/Biblia ON/OFF e insercao de conteudo

## 6. Go/No-Go para release

- GO: Todos os itens acima com PASS
- NO-GO: Qualquer FAIL em smoke test, build, instalador ou NDI
