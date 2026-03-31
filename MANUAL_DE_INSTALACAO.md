# Manual de Instalacao - MediaLayers

## 1. Arquivos para distribuir no Windows

Para entregar o MediaLayers a outra pessoa no Windows, envie:

- MediaLayers-Setup-x.y.z.exe

Envie tambem, se for usar atualizacao automatica:

- latest.yml
- arquivo .blockmap correspondente

## 2. Como instalar no Windows

1. Execute o arquivo MediaLayers-Setup-x.y.z.exe.
2. Se o Windows SmartScreen alertar, clique em Mais informacoes e depois em Executar assim mesmo.
3. Siga o assistente de instalacao.
4. Conclua a instalacao.
5. Abra o MediaLayers pelo atalho criado.

## 3. Primeira validacao apos instalar

1. O app abre sem erro.
2. A interface principal aparece completa.
3. A janela de saida abre.
4. O layout nao fica sobreposto.
5. O controle remoto aparece com links prontos na aba Controle Remoto.

## 4. Teste rapido apos instalar

### Preview / Program

1. Adicione uma midia.
2. Confirme no Preview.
3. Clique em Take.
4. Confirme no Program e na janela de saida.

### Controle remoto

1. Abra a aba Controle Remoto.
2. Copie um dos links mostrados.
3. Abra esse link no celular.
4. Teste Anterior, Proximo, TAKE e CLEAR.

### NDI

1. Adicione uma layer NDI.
2. Conecte a fonte desejada.
3. Inicie o NDI Output.
4. Verifique em outro receptor NDI.

### Fallback

Se o NDI nao estiver disponivel, o app deve continuar abrindo e operando sem travar.

## 5. Instalacao em Linux para desenvolvimento

1. Execute npm install.
2. Execute npm start.
3. Use a aba Atualizacoes apenas para configurar e validar a URL; o auto-update completo e testado em build empacotada.

## 6. Como gerar a release Windows

Use:

```bash
npm run build:win
```

Arquivos esperados em dist:

- MediaLayers-Setup-x.y.z.exe
- latest.yml
- arquivo .blockmap
- win-unpacked

## 7. Como publicar no GitHub Releases

Repositorio final de publicacao:

```text
https://github.com/Alexandre-Gervasio/medialayers
```

Fluxo recomendado:

1. Atualize a versao em package.json.
2. Faça commit e crie uma tag no formato vX.Y.Z.
3. Envie branch e tag para o GitHub.
4. O workflow .github/workflows/windows-build.yml gera o instalador e publica os assets da release.

Comandos:

```bash
git add .
git commit -m "release: v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

URL final da release:

```text
https://github.com/Alexandre-Gervasio/medialayers/releases/tag/v1.0.1
```

URL final de downloads:

```text
https://github.com/Alexandre-Gervasio/medialayers/releases/download/v1.0.1/
```

Arquivos publicados nesse endereco:

- https://github.com/Alexandre-Gervasio/medialayers/releases/download/v1.0.1/MediaLayers-Setup-1.0.1.exe
- https://github.com/Alexandre-Gervasio/medialayers/releases/download/v1.0.1/latest.yml
- https://github.com/Alexandre-Gervasio/medialayers/releases/download/v1.0.1/MediaLayers-Setup-1.0.1.exe.blockmap

## 8. Como funciona o auto-update

O MediaLayers agora possui interface de configuracao de update dentro do app.

Para isso funcionar nos computadores dos usuarios:

1. Gere e publique uma release no GitHub com tag vX.Y.Z.
2. O app instalado no Windows verifica o GitHub Releases por padrao.
3. No MediaLayers do usuario final, abra a aba Atualizacoes.
4. Clique em Verificar agora.
5. Quando o download terminar, clique em Instalar update.
6. Se quiser usar outro servidor, informe a URL base customizada e clique em Salvar.

Observacoes:

- em desenvolvimento no Linux, o app mostra apenas status de configuracao
- a instalacao automatica do update acontece na build empacotada

## 9. Exemplo de estrutura de publicacao customizada

Exemplo de URL base:

```text
https://seu-dominio.com/medialayers/
```

Arquivos publicados nesse endereco:

- https://seu-dominio.com/medialayers/latest.yml
- https://seu-dominio.com/medialayers/MediaLayers-Setup-1.0.1.exe
- https://seu-dominio.com/medialayers/MediaLayers-Setup-1.0.1.exe.blockmap

## 10. Checklist final de entrega

1. Build terminou sem erro.
2. dist contem o .exe.
3. dist contem latest.yml.
4. O app abre normalmente.
5. Preview / Program funciona.
6. Controle remoto funciona pelo link mostrado na aba.
7. NDI funciona ou faz fallback sem crash.

## 11. Problemas comuns

### O update nao baixa

- confirme que latest.yml esta publicado
- confirme que a URL base esta correta
- confirme acesso HTTPS sem bloqueio

### O celular nao conecta

- confirme a mesma rede
- confirme a porta 3900 liberada
- tente outro link listado na aba Controle Remoto

### O Windows bloqueou o instalador

- valide SmartScreen
- valide antivirus
- distribua builds assinadas quando entrar em producao

### NDI nao funciona

- confirmar instalacao e disponibilidade do ambiente NDI
- verificar rede local
- testar com outro receptor

## 12. Resumo objetivo

Para distribuir no Windows hoje:

1. gere o build com npm run build:win
2. publique a tag vX.Y.Z no GitHub
3. envie o arquivo Setup .exe ou compartilhe a URL da release
4. para auto-update, mantenha latest.yml e blockmap anexados na release
