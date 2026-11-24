# Formatação
- O CI roda `yarn format:check`. Antes da PR, formate os arquivos do diff (`git diff <base>...HEAD --name-only | xargs npx prettier --write`) num commit `style:` à parte; `prettier --write` num arquivo que o diff não tocou reflowa linhas alheias.

# E2E
- O Playwright reaproveita o dev server em `localhost:8800`. Suba com `PORT=8800 yarn dev` (o `PORT` do `.env.local` o `next dev` ignora e sobe na 3000); em outra porta o Playwright tenta subir um segundo `next dev` no mesmo diretório e falha.
- O e2e do diff: `yarn check:e2e-local` (confere servidor e Storage em segundos, roda `test:e2e:diff`, ~12 min, e ignora só os testes que sobem arquivo quando a sonda do Storage dá `42P10`). Com a rodada manual, `--reporter=list` num arquivo mostra o progresso; `| tail` deixa a saída vazia até o fim.
- Os e2e de leitura (foto do cartão, atestado, convenção) esperam os leitores falsos: o `.env.local` do dev server reaproveitado leva `LEITURA_CARTAO_MODO=falso` e `EXTRACAO_CONVENCAO_MODO=falso`. Com `visao`, o leitor real recusa a foto falsa e o teste falha.

# Edição de arquivos
- O working tree está em LF na maior parte, mas alguns arquivos ficam em CRLF (`git ls-files --eol`, coluna `w/crlf`): edite com `Edit` ou `Write`; script de `replace` (node, sed) em arquivo CRLF não casa e falha em silêncio, então normalize `\r\n` para `\n` antes. O aviso "LF will be replaced by CRLF" do Git é esperado.
- Crie arquivo com `Write`: heredoc (`<<'EOF'`) com texto em português quebra o `Bash`.
- Trecho com `\` (regex, `\n`) entra por `Edit` ou `Write`: `node -e` inline engole a barra invertida e grava o código quebrado. Não há `python` na máquina.

# Testes
- Uma suíte só: `yarn test --testPathPatterns <padrão>`. O padrão posicional (`yarn test <padrão>`) é ignorado e roda as 327 suítes (~40 s).
- Nunca rode `npx jest` puro: ele sobe os projetos unit e integration juntos e as suítes de integração (`*.test.ts`) disputam o mesmo banco local, o que gera falha que some ao rodar isolada. Use `yarn test` (unit) e `yarn test:int` (integração, em série); `yarn test:all` roda os dois.
- Storage local quebrado (`database error, code: 42P10` ao subir arquivo): derruba ~13 suítes de `yarn test:int` (buckets, avatar, anexos, PDF de guia) e todo e2e que cria Cliente pelo `criarClienteComoAdmin` (sobe o contrato social). Falha de ambiente, não do diff: `yarn check:int-local` roda a integração como o CI, ignora as suítes de Storage (lista em `.claude/scripts/checar-int-local.mjs`) só quando a sonda do Storage dá `42P10` e falha em qualquer outra suíte vermelha. Antes de todo push: `yarn check:int-local` (o `ci:local` já o inclui); o job "Integração (Supabase local)" do CI quebrou na PR por falta dessa rodada local. Para validar um e2e sem Storage, crie o Cliente direto no banco com `adminLocal()` (`cliente_contatos.id` e `cliente_responsaveis` não têm default: passe `id`).
- Os testes de integração leem tabelas compartilhadas com o e2e (que deixa Clientes no banco até a rodada seguinte): filtre todo `select` por `cliente_id`.
- Commit de feat/fix que muda o comportamento de uma tela roda antes `yarn test --testPathPatterns <módulo tocado>`: spec velho fica vermelho sem ninguém ver até o gate (3 specs de contato ficaram assim após o "Deixar de usar").
- DTO de cadastro nos specs vem de `test-support/cadastro-de-teste.ts` (`cadastroOperacionalDeTeste`, `cadastroRhDeTeste`): campo novo no DTO entra lá, num lugar só.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
