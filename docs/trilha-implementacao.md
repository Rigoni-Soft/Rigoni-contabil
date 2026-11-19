# Trilha de implementação: tickets agrupados por PR

Criada em 2026-11-17, em substituição à trilha do RH (#212, tickets #213 a #225, todos entregues e mergeados até a PR #238). Duas frentes, com 8 PRs em 2 trilhas independentes: **Avatar** (spec #270, mapa #263, tickets #284 a #289) e **Contatos por Cliente e envio por Setor** (spec #283, mapa #271, tickets #290 a #298). `[x]` = implementado. `[ ]` = falta. Cada bloco **PR** é um grupo que pode ser aberto como PR independente e testado sozinho.

Cada ticket é uma fatia vertical (banco, regra de negócio, tela e testes juntos); o rótulo `frente:` de cada um diz o que ele toca. Se uma PR ficar pesada na revisão, separe a migration e a regra de negócio da tela, nessa ordem.

As duas trilhas não dependem uma da outra e podem andar em paralelo.

## Trilha A: Avatar (spec #270)

### Etapa A1: Base

- [x] **PR A1: Escopo do usuário e bucket de avatares** (base da trilha; sem dependência)
  - [x] #284 (ambas): módulo de escopo do usuário: rótulo, home e logo por Papel e Setor
  - [x] #285 (backend): migration do bucket `avatares` e da coluna `avatar_atualizado_em`

### Etapa A2: Avatar no cabeçalho

- [x] **PR A2: Avatar vira link para a home e mostra a logo** (depende do #284, na PR A1)
  - [x] #286 (frontend): avatar do cabeçalho vira link para a home em todas as telas (bloqueado por #284)
  - [x] #287 (frontend): avatar mostra a logo do Setor ou a do escritório (bloqueado por #286)

### Etapa A3: Foto personalizada

- [x] **PR A3: Foto do avatar em Meu perfil** (depende dos #285 e #287, nas PRs A1 e A2)
  - [x] #288 (ambas): enviar, trocar e remover a foto do avatar (bloqueado por #285 e #287)
  - [x] #289 (ambas): desativar usuário apaga a foto e a pendência vira derivada (bloqueado por #288)

## Trilha B: Contatos por Cliente e envio por Setor (spec #283)

As quatro entregas da spec (Dados, Cadastro, Envios e aviso, Recepção) vão **juntas a produção**: a migration nunca vai sem o campo de contatos e sem os envios lendo os destinos. O roteiro de deploy (#298) fecha a trilha. ADR: `docs/adr/0013-contato-com-varios-setores-dono-e-destino-por-tipo.md`.

### Etapa B1: Dados

- [x] **PR B1: Contato com Setores e dono, URA lendo a tabela nova** (base da trilha; sem dependência)
  - [x] #290 (ambas): contato com e-mail, Setores, dono e id estável (sem bloqueio)
  - [x] #291 (ambas): URA, fila e balão leem a tabela nova de contatos (bloqueado por #290)
- [x] **PR B2: Destinos de envio e resolução no banco** (depende do #290, na PR B1)
  - [x] #292 (backend): destinos de envio, catálogo de tipos e resolução no banco (bloqueado por #290)

### Etapa B2: Cadastro

- [x] **PR B3: Campo de contatos e destinos no SN, no RH e no Admin** (depende do #292, na PR B2)
  - [x] #293 (ambas): "editar cadastro" do SN com contatos e destinos por Setor (bloqueado por #292)
  - [x] #294 (frontend): mesmo campo no Cadastro do Cliente do RH e no Admin (bloqueado por #293)

### Etapa B3: Envios e aviso

- [ ] **PR B4: Envios lendo os destinos e aviso de cliente sem meio de envio** (depende das PRs B2 e B3)
  - [ ] #295 (backend): lembrete e DAS do SN leem os destinos, com o aviso (bloqueado por #292 e #293)
  - [ ] #296 (backend): guias de parcelamento do SN e do RH leem os destinos (bloqueado por #294 e #295)

### Etapa B4: Recepção e deploy

- [ ] **PR B5: Recepção cadastra contato URA no atendimento** (depende só do #291, na PR B1; em paralelo às PRs B2 a B4)
  - [ ] #297 (ambas): botão "Cadastrar como contato deste Cliente" (bloqueado por #291)
- [ ] **PR B6: Roteiro de deploy** (por último; depende das PRs B4 e B5)
  - [ ] #298 (backend): roteiro com o SN cadastrando os destinos antes da primeira rodada do job (bloqueado por #296 e #297)

---

## Notas

- As dependências entre tickets estão como bloqueios nativos nas issues. Os bloqueios entre PRs foram derivados deles. Confirme antes de abrir cada PR.
- Pode começar já: #284, #285 (Trilha A) e #290 (Trilha B), sem bloqueio.
- Fora desta trilha, anotado para depois: acrescentar nos serviços do menu de guias de pagamento de impostos o processo de verificar se a DCTFWeb está pronta, emitir e enviar a guia do DARF aos clientes, entrando nos jobs e nos temas locais que já enviam o DAS.
