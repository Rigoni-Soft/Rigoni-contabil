# Formatação
- O CI roda `yarn format:check`. Antes da PR, formate os arquivos do diff (`git diff <base>...HEAD --name-only | xargs npx prettier --write`) num commit `style:` à parte; `prettier --write` num arquivo que o diff não tocou reflowa linhas alheias.

# E2E
- O Playwright reaproveita o dev server em `localhost:8800`. Com `PORT=8800` no `.env.local` o `yarn dev` aberto serve o e2e; em outra porta o Playwright tenta subir um segundo `next dev` no mesmo diretório e falha.
- Os e2e de leitura (foto do cartão, atestado, convenção) esperam os leitores falsos: o `.env.local` do dev server reaproveitado leva `LEITURA_CARTAO_MODO=falso` e `EXTRACAO_CONVENCAO_MODO=falso`. Com `visao`, o leitor real recusa a foto falsa e o teste falha.

# Edição de arquivos
- O working tree está em LF na maior parte, mas alguns arquivos ficam em CRLF (`git ls-files --eol`, coluna `w/crlf`): edite com `Edit` ou `Write`; script de `replace` (node, sed) em arquivo CRLF não casa e falha em silêncio, então normalize `\r\n` para `\n` antes. O aviso "LF will be replaced by CRLF" do Git é esperado.
- Crie arquivo com `Write`: heredoc (`<<'EOF'`) com texto em português quebra o `Bash`.
- Trecho com `\` (regex, `\n`) entra por `Edit` ou `Write`: `node -e` inline engole a barra invertida e grava o código quebrado. Não há `python` na máquina.

# Testes
- Uma suíte só: `yarn test --testPathPatterns <padrão>`. O padrão posicional (`yarn test <padrão>`) é ignorado e roda as 327 suítes (~40 s).
- Nunca rode `npx jest` puro: ele sobe os projetos unit e integration juntos e as suítes de integração (`*.test.ts`) disputam o mesmo banco local, o que gera falha que some ao rodar isolada. Use `yarn test` (unit) e `yarn test:int` (integração, em série); `yarn test:all` roda os dois.
- Storage local quebrado (`database error, code: 42P10` ao subir arquivo): derruba ~13 suítes de `yarn test:int` (buckets, avatar, anexos, PDF de guia) e todo e2e que cria Cliente pelo `criarClienteComoAdmin` (sobe o contrato social). Falha de ambiente, não do diff: antes de investigar, confira se o erro cita `42P10` e compare a lista de suítes vermelhas com esta. Para validar um e2e sem Storage, crie o Cliente direto no banco com `adminLocal()` (`cliente_contatos.id` e `cliente_responsaveis` não têm default: passe `id`).
- Os testes de integração leem tabelas compartilhadas com o e2e (que deixa Clientes no banco até a rodada seguinte): filtre todo `select` por `cliente_id`.
- DTO de cadastro nos specs vem de `test-support/cadastro-de-teste.ts` (`cadastroOperacionalDeTeste`, `cadastroRhDeTeste`): campo novo no DTO entra lá, num lugar só.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
