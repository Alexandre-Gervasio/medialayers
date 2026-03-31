# Manual do Usuario - MediaLayers

## 1. O que e o MediaLayers

O MediaLayers e um software de apresentacao de midia em tempo real para operacao ao vivo, com foco em preview, program, layers, NDI, browser source e controle remoto.

## 2. Interface principal

O layout principal funciona como uma mesa de operacao modular.

Paineis principais:

- Entradas: lista de layers e area de drag and drop
- Preview / Program: mesa de corte com os dois monitores internos
- Propriedades: ajuste da layer selecionada
- Controle Remoto: links prontos para abrir o controle no celular
- Atualizacoes: configuracao e status do auto-update
- Timeline / Editor de Clipes: area inferior para organizacao

## 3. Fluxo basico de operacao

1. Adicione uma midia com + Midia, drag and drop ou Browser Source.
2. Selecione a layer nas Entradas.
3. Confira no Preview.
4. Use Take para enviar ao Program.
5. O Program e a janela de saida recebem o estado final em tempo real.

## 4. Layers

Cada layer pode representar:

- texto
- imagem
- video
- audio
- browser source
- NDI

Controles por layer:

- Cue: envia a layer para Preview
- Take: envia a layer para Program
- Prog: liga ou desliga a layer no Program
- X: remove a layer

No painel Propriedades, voce pode editar nome, visibilidade, opacidade, texto e URL, conforme o tipo da layer.

## 5. Preview e Program

O Preview mostra o que esta sendo preparado.

O Program mostra o que esta no ar.

Use os botoes:

- Cut: envia a layer do Preview para o Program
- Clear Program: limpa a saida atual

## 6. Drag and drop

Voce pode arrastar arquivos direto para a interface.

Formatos aceitos automaticamente:

- imagem
- video
- audio

Ao soltar, o MediaLayers cria uma layer apropriada.

## 7. Browser Source

Use o botao + Browser para criar uma layer a partir de uma URL.

Exemplos de uso:

- pagina web
- painel HTML remoto
- camera web via pagina
- stream HTTP exibido em pagina compatível

## 8. Plugins de Texto e Biblia

Os plugins de Texto e Biblia podem ser ligados ou desligados na barra superior.

Uso comum:

- Texto Plugin: mensagens, letras e avisos
- Versiculo: criacao rapida de referencias biblicas em tela

## 9. Controle remoto pelo celular

Nao e mais necessario procurar o IP manualmente no sistema operacional.

Use a aba Controle Remoto no proprio MediaLayers.

Ela mostra os links ja prontos para acesso pelo celular.

Como usar:

1. Abra o MediaLayers no computador principal.
2. Abra a aba Controle Remoto.
3. Copie um dos links da rede local mostrados ali.
4. Abra esse link no celular.
5. Use os botoes Anterior, Proximo, TAKE e CLEAR.

Requisitos:

- computador e celular na mesma rede
- app principal aberto
- porta 3900 liberada no firewall

## 10. NDI

### Entrada NDI

Use + NDI para localizar fontes NDI na rede e criar uma layer conectada.

### Saida NDI

Use os botoes:

- Iniciar NDI Output
- Parar NDI Output

Se o NDI nao estiver disponivel, o app deve seguir operando sem travar.

## 11. Atualizacoes automaticas

O MediaLayers agora possui uma aba Atualizacoes.

Ela permite:

- configurar a URL do servidor de updates
- decidir se deve verificar ao iniciar
- verificar updates manualmente
- instalar a atualizacao baixada

Como usar:

1. Publique sua nova release em um servidor HTTPS.
2. Garanta que esse servidor exponha os arquivos da release, incluindo latest.yml.
3. No MediaLayers instalado do usuario, abra a aba Atualizacoes.
4. Informe a URL base da release.
5. Clique em Salvar.
6. Clique em Verificar agora.
7. Quando o update for baixado, clique em Instalar update.

Observacao:

- o auto-update funciona em builds empacotadas
- em modo desenvolvimento no Linux, a aba exibe apenas status de configuracao

## 12. Solucao rapida de problemas

### O controle remoto nao abre no celular

- confira a aba Controle Remoto
- confirme que o celular esta na mesma rede
- teste outro link mostrado na aba
- verifique o firewall da maquina host

### O update nao aparece

- confirme que a URL base esta correta
- confirme que latest.yml esta publicado nessa URL
- confirme que o app esta usando build empacotada

### O NDI nao funciona

- confirme que a rede esta ok
- confirme que ha fonte NDI ativa
- teste o fallback sem NDI para validar que o app nao trava

## 13. Boas praticas

- use uma maquina dedicada para operacao ao vivo
- feche programas desnecessarios
- teste todas as fontes antes do evento
- mantenha layouts salvos
- valide NDI e rede local com antecedencia
- use resolucao compativel com a saida final
- mantenha backup do instalador e da versao anterior

## 14. Solucao rapida de problemas

### 14.1 O celular nao conecta

- confirme o IP correto do computador
- confirme a porta 3900
- confira firewall e antivirus
- teste abrir http://localhost:3900 no proprio computador

### 14.2 A saida nao aparece

- verifique se a janela output abriu
- confira se o conteudo foi enviado ao program
- teste com uma camada simples primeiro

### 14.3 NDI nao aparece

- confirme que a fonte NDI esta ativa
- confira se a rede permite discovery NDI
- teste com outro receptor NDI
- confirme que o fallback nao esta bloqueando a operacao

### 14.4 Layout baguncado

- use restaurar layout
- se necessario, use reset layout

## 15. Resumo objetivo

Para operar bem o MediaLayers:

- monte o conteudo no Preview
- envie ao Program no momento certo
- use layers para composicao
- acesse o remoto pelo celular usando os links da aba Controle Remoto
- para update automatico em outros PCs, use publicacao com latest.yml e a aba Atualizacoes

Use esse painel para:

- selecionar a camada ativa
- organizar ordem de sobreposicao
- ativar ou desativar visibilidade
- conectar fontes NDI por camada
- preparar o conteudo que sera enviado ao output

### 2.2 Preview

Mostra em tempo real a composicao atual que esta sendo preparada.

O Preview serve para:

- conferir o resultado visual antes de enviar
- validar alinhamento, escala e sobreposicao
- monitorar camadas NDI, texto, imagem, video e fontes remotas

### 2.3 Program / Output

Representa a saida efetiva mostrada para o publico.

A janela de output e separada da interface principal. O conteudo enviado para a saida deve refletir a operacao do software em tempo real.

### 2.4 Propriedades

Painel usado para editar a camada selecionada.

Pode incluir:

- opacidade
- visibilidade
- conteudo textual
- configuracoes de origem
- parametros de composicao

### 2.5 Timeline / Editor inferior

Area dedicada a organizacao temporal e operacao de clipes.

## 3. Como usar o Preview e o Program

O fluxo recomendado e:

1. Adicione ou conecte o conteudo em uma camada.
2. Ajuste no Preview.
3. Confira a composicao.
4. Envie para o Program / Output quando estiver pronto.

Esse modelo permite preparar o conteudo sem alterar a exibicao ao vivo ate a hora certa.

## 4. Reorganizar os paineis

O layout da interface e dinamico.

Voce pode:

- arrastar paineis
- redimensionar paineis
- reorganizar a posicao
- usar abas dentro dos paineis
- salvar o layout atual
- restaurar ou resetar o layout

Fluxo recomendado:

1. Monte a interface do jeito mais confortavel para sua operacao.
2. Use o comando de salvar layout.
3. Se algo ficar desorganizado, use restaurar.
4. Se quiser voltar ao padrao, use reset.

## 5. Drag and drop de arquivos

O software foi estruturado para receber arquivos diretamente na interface.

Tipos esperados:

- imagem
- video
- audio

Uso recomendado:

1. Arraste o arquivo para a area de trabalho do software.
2. O sistema deve identificar o tipo de midia.
3. O conteudo entra na camada ou biblioteca adequada.
4. Ajuste a camada antes de enviar para a saida.

## 6. Plugins de Texto e Biblia

O projeto possui estrutura modular para plugins.

### 6.1 Plugin de Texto

Use para:

- letras de musica
- frases
- avisos
- textos livres

### 6.2 Plugin de Biblia

Use para:

- versiculos
- referencias biblicas
- exibicao em tela

Esses modulos podem ser ativados ou desativados conforme a necessidade operacional.

## 7. Fontes remotas estilo Browser Source

O software aceita fontes remotas, no modelo semelhante ao Browser Source.

Pode ser usado com:

- URL HTTP/HTTPS
- pagina web incorporada
- WebRTC
- stream remoto

Uso recomendado:

1. Crie uma camada remota.
2. Informe a URL ou a origem WebRTC.
3. Aguarde a conexao.
4. Valide o conteudo no Preview antes de colocar no Program.

## 8. Controle remoto pelo celular

O controle remoto ja existe no projeto e sobe junto com o aplicativo principal.

### 8.1 Endereco padrao

Acesse no celular:

http://IP_DO_COMPUTADOR:3900

Exemplo:

http://192.168.0.25:3900

### 8.2 Como descobrir o IP do computador

No computador que esta rodando o MediaLayers:

- Linux: use o comando ip addr ou hostname -I
- Windows: use o comando ipconfig

Voce deve pegar o IP da rede local, normalmente algo como 192.168.x.x ou 10.x.x.x.

### 8.3 Requisitos para funcionar

- celular e computador precisam estar na mesma rede
- porta 3900 precisa estar liberada no firewall
- o MediaLayers precisa estar aberto

### 8.4 Comandos disponiveis atualmente

A interface mobile atual possui os botoes:

- Anterior
- Proximo
- TAKE
- CLEAR

### 8.5 Se nao abrir no celular

Verifique:

1. se o app principal esta aberto
2. se o computador e o celular estao na mesma rede
3. se o endereco esta correto
4. se a porta 3900 nao esta bloqueada
5. se o antivurus ou firewall nao bloqueou o acesso

## 9. NDI

O software possui pipeline para entrada e saida NDI.

### 9.1 Entrada NDI

Use uma camada para conectar uma fonte NDI disponivel.

Fluxo:

1. selecione a camada
2. conecte a fonte NDI
3. valide no Preview

### 9.2 Saida NDI

A composicao final pode ser enviada para NDI Output.

Fluxo:

1. prepare a composicao no preview
2. inicie o NDI output
3. monitore a recepcao em outro software compativel com NDI

### 9.3 Se nao houver NDI disponivel

O comportamento esperado e fallback sem travamento do software.

## 10. Atualizacoes do software para outros computadores

Hoje o projeto ja gera os arquivos usados em release, inclusive latest.yml.

Para que o computador de outra pessoa atualize automaticamente quando voce publicar nova versao, a abordagem recomendada e:

1. hospedar o instalador e o latest.yml em um servidor HTTPS
2. integrar electron-updater no aplicativo
3. publicar cada nova versao com versionamento correto
4. fazer o app verificar updates ao iniciar ou sob demanda

Sem isso, a atualizacao ainda e manual:

1. voce gera uma nova versao
2. envia o novo instalador
3. a outra pessoa instala por cima

## 11. Modo portatil

Sim, o software pode existir em modo portatil.

O projeto ja possui script de build para isso:

npm run build:win-portable

No modo portatil:

- nao exige instalacao tradicional
- pode rodar a partir de uma pasta ou pendrive
- ainda pode depender de arquivos e permissoes locais
- e recomendado testar NDI, firewall e codecs no computador alvo

## 12. Fluxo recomendado de operacao ao vivo

1. Abra o MediaLayers.
2. Organize o layout da interface.
3. Conecte as entradas necessarias.
4. Monte as camadas.
5. Confira no Preview.
6. Envie para o Program.
7. Se necessario, controle pelo celular.
8. Se usar NDI, monitore a entrada e a saida.

## 13. Boas praticas

- use uma maquina dedicada para operacao ao vivo
- feche programas desnecessarios
- teste todas as fontes antes do evento
- mantenha layouts salvos
- valide NDI e rede local com antecedencia
- use resolucao compativel com a saida final
- mantenha backup do instalador e da versao anterior

## 14. Solucao rapida de problemas

### 14.1 O celular nao conecta

- confirme o IP correto do computador
- confirme a porta 3900
- confira firewall e antivirus
- teste abrir http://localhost:3900 no proprio computador

### 14.2 A saida nao aparece

- verifique se a janela output abriu
- confira se o conteudo foi enviado ao program
- teste com uma camada simples primeiro

### 14.3 NDI nao aparece

- confirme que a fonte NDI esta ativa
- confira se a rede permite discovery NDI
- teste com outro receptor NDI
- confirme que o fallback nao esta bloqueando a operacao

### 14.4 Layout baguncado

- use restaurar layout
- se necessario, use reset layout

## 15. Resumo objetivo

Para operar bem o MediaLayers:

- monte o conteudo no Preview
- envie ao Program no momento certo
- use layers para composicao
- acesse o remoto pelo celular em http://IP_DO_COMPUTADOR:3900
- gere versao portatil com npm run build:win-portable
- para update automatico em outros PCs, use publicacao com latest.yml e integracao de auto-update
