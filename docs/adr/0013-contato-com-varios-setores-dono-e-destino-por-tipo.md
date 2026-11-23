# ADR 0013 — Contato com vários Setores, Setor dono e Destino de envio por Tipo, resolvido no banco

**Status:** aceita (2026-11-17) — spec #283, mapa #271

## Contexto

O Contato era "nome + WhatsApp" com um padrão por Cliente, e o e-mail e a forma de envio eram campos
únicos (o do Cliente e o do cadastro do SN). Cada Setor precisa mandar documentos e avisos a pessoas
diferentes do mesmo Cliente, e a edição apagava e recriava todos os Contatos, o que impede um vínculo
estável entre Contato e destino.

## Decisão

- **Contato é do Cliente e tem vários Setores.** Um Contato pertence a um único Cliente e a um ou mais
  Setores (URA mais os escolhidos). A URA é só rótulo, obrigatório, nunca destino nem Setor de usuário;
  a lista de Setores do Contato é uma tabela de referência, fora do enum de login.
- **O Setor que cadastra é o dono.** Só ele e o Admin editam nome, WhatsApp e e-mail. Os outros Setores
  escolhem o Contato e definem só o seu canal e tipo. Excluir pelo dono, com outro Setor ainda o usando, não apaga o Contato: ele passa à URA (sem dono) e segue disponível a quem o escolheu.
- **Destino de envio é a unidade do envio**: (Cliente, Setor, Tipo de envio, Contato, canal), com
  "todos os envios do Setor" como padrão. O canal é do Destino, gravado explícito.
- **O banco resolve "quem recebe este envio".** Uma peça no banco devolve os Destinos já resolvidos por
  Setor, Tipo e canal; os jobs só entregam. Mesma linha do ADR 0009 ("o banco manda") e do 0008 (estado
  do sistema fica no banco).
- **O canal é escolhido por Contato e Setor, não por tipo.** Contato com um canal só: o canal é o dele.
  Com WhatsApp e e-mail, `definir_tipos_de_envio_do_contato` exige o canal (sem padrão; recusa com
  `22023`) e o aplica a todos os Destinos do Contato naquele Setor; deixar de usar o Contato (sem tipos)
  não pede canal (#293).
- **O dono que sai passa o Contato à URA por um gancho no `BEFORE DELETE`.** O gatilho
  `contato_exclusao_em_uso` cancela o `DELETE` (zero linhas afetadas; o salvar do cadastro não recebe erro,
  coberto em `destinos-de-envio.repository.test.ts`, e o Contato sai da lista do dono) e grava `dono_setor = null` na mesma transação. A regra "o dono
  não troca" abre uma exceção só para esse caso, lida de `app.contato_herdado_pela_ura` (`set_config` local,
  com o id do Contato). Hoje o PostgREST não alcança esse parâmetro; a invariante, porém, depende de nenhuma
  função futura chamar `set_config` com esse nome. Aceito pela simplicidade; se outra rota precisar mudar o
  dono, a saída é uma função própria, não ampliar o gancho.
- **Id estável**: a edição de Contatos cria, atualiza e remove por identificador, num caminho único.
- **Sem "Contato padrão".** A migration não cria Contatos nem Destinos; os Contatos que existem ficam com
  setor URA e o SN fica sem Destino até cadastrar, com aviso do job.

## Consequências

- Os envios automáticos do SN só voltam depois de o SN cadastrar os Destinos; o roteiro de deploy
  exige isso antes da primeira rodada do job.
- Todo Contato é reconhecido pela URA, qualquer que seja o Setor dono: quem um Setor cadastra passa a
  poder pedir documentos do Cliente na URA.
- A tabela de Contatos e a lista de Setores são reaproveitáveis pela ficha de Cliente e pela estrutura
  organizacional (próximo deploy).
- Alternativa descartada: Contato por Setor (um registro por Setor). Duplicaria pessoas e dados e
  impediria um Setor de aproveitar o Contato que outro já cadastrou.
