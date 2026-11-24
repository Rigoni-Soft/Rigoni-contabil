# Regras do Clientes (presentation) e dos contratos do RH

Conhecimento que vivia em comentários dos view-models de clientes e dos DTOs/portas do RH.

## Contato do Cliente: DDD e dono
O DDD só é cobrado de número novo ou trocado (o número original viaja nos valores, fora do formulário). O Setor dono do contato (null = Admin) nunca vai ao banco: só o dono e o Admin gravam, e quem decide é a RLS. A tela deixa em leitura o contato de outro Setor.
Onde vive: src/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema.ts

## Teto do corpo da Server Action (ADR 0007)
O corpo de uma Server Action na Vercel tem teto de 4,5 MB, somando todos os anexos novos; o limite é 4 MB. O bucket aceita 10 MiB, mas acima de 4 MB o upload direto ao Storage exigiria política de usuário no bucket. Por isso Parcelamentos, guias e PDFs vão por Server Action própria, depois do cadastro, e o payload do cadastro nunca leva PDF.
Onde vive: editar-cadastro-operacional.schema.ts; use-parcelamentos-do-cadastro.hook.ts; use-salvar-cadastro-operacional.hook.ts

## Envios do contato (tipos e canal)
O que o contato recebe do Setor (tipos, canal) é estado da linha: grava por ação própria, na hora, e nunca vai no payload do cadastro. "Todos os envios" marca todos os outros; desmarcar um desmarca o "Todos"; marcar o último que faltava o marca. O "Enviar por" só existe para contato com os dois canais e ao menos um envio marcado (o banco exige a escolha e ignora nos demais). Canal perdido (número ou e-mail apagado) avisa na linha antes de salvar.
Onde vive: tipos-de-envio.presenter.ts; tipos-de-envio.schema.ts; use-gravar-contato-da-linha.hook.ts

## Linhas de contato: quem vê e edita o quê
Admin e quem só visualiza veem todos os contatos; o Setor vê os que cadastrou ou escolheu e edita só os que cadastrou. O Admin não tem Setor: só cadastra contatos. Contato de outro Setor escolhido sem ao menos um envio não entra na lista; "Deixar de usar" tira os envios do Setor e o contato segue com o dono e os outros Setores. Linha em edição com algo digitado segura o Salvar do cadastro; linha nova em branco não. Número repetido da linha nova oferece usar o contato do Cliente que já o tem.
Onde vive: use-contatos-do-cadastro.hook.ts; use-deixar-de-usar-contato.hook.ts; opcoes-da-linha.presenter.ts

## Gravação da linha em duas chamadas
O contato e, depois, os envios. Se só os envios falham, o contato já ficou gravado: a linha segue em edição e o gravado não se regrava na nova tentativa.
Onde vive: use-gravar-contato-da-linha.hook.ts; use-contatos-do-cadastro.hook.ts

## Leitura do PDF de Parcelamento
Falha de leitura (ou da Server Action) nunca bloqueia: sem resposta no tempo limite a linha vira "digite à mão" (a action não se cancela). Vale só a resposta do PDF mais recente de cada linha; resposta tardia de PDF trocado, linha removida ou formulário refeito (Limpar) é descartada. Os dados do acordo pertencem ao PDF que os trouxe: trocar, remover ou falhar a leitura limpa os do anterior.
Onde vive: use-leitura-do-pdf.hook.ts; leitura-do-pdf-de-parcelamento.container.spec.tsx

## Salvar Parcelamentos e guias
Cada Setor salva os seus Parcelamentos. Os ids voltam para as linhas antes de anexar a guia: nova tentativa atualiza os acordos salvos em vez de recriá-los (e apagar as guias em cascata). Guia recusada (ex.: CNPJ de outra empresa) não desfaz o Parcelamento: avisa e a guia se anexa em "Guias da parcela". Anexada ou recusada, a guia sai do formulário.
Onde vive: use-parcelamentos-do-cadastro.hook.ts

## Saga de salvar o cadastro operacional
Cadastro, depois Parcelamentos (e guias), depois Responsável. Se só a atribuição do Responsável falha, o retrato do que foi persistido é guardado e reenviar o mesmo formulário repete só a atribuição; mexer em outro campo volta ao salvamento completo. try/finally: rejeição de transporte não deixa o botão preso em "Salvando...".
Onde vive: use-salvar-cadastro-operacional.hook.ts

## Responsável do Setor
O SN atribui no próprio cadastro; o Líder dos demais Setores, no bloco do Setor dele. A consulta de Responsáveis só roda (enabled) quando o Líder abre o Select. O Admin grava só as observações do RH, sem mexer em contatos.
Onde vive: responsavel-do-setor.presenter.ts; responsaveis.queries.ts; observacoes-do-rh.container.tsx

## Cadastro do RH reaproveita o formulário do SN
Os campos do SN ficam neutros e nunca são enviados; o schema do RH os descarta. O formulário chama de observacoesGerais o que a action chama de observacoes.
Onde vive: editar-cadastro-rh/editar-cadastro-rh.container.tsx; editar-cadastro-rh.schema.ts

## Server loaders sem tipo de retorno explícito
Os arquivos .server.ts não anotam o retorno: nomear o Result/DTO do módulo violaria "presentation não importa domain/infra" (arquitetura.md §3.4); o shape flui por inferência.
Onde vive: os arquivos *.server.ts de view-models

## Documento contratual
Em destaque: a alteração apontada pelo aviso (?alteracao=, só inteiro positivo; outro valor é ignorado) quando existe; senão a de maior número (contrato social só sem alteração). Sem acesso (lista vazia): sem cartão; falha ao consultar: aviso com saída. Com cache fresco a alteração pedida pode faltar só no cache: a lista é relida uma vez por Cliente+número antes de concluir que não existe, e o cartão reserva a altura enquanto isso. O link assinado nasce no clique (120 s) e a tela nunca vê o caminho. Server Action é endpoint público: o clienteId é validado mesmo vindo da UI. O clienteId é guid, não uuid (ids do seed não são v4). Só o Admin anexa alteração.
Onde vive: documentos-contratuais.presenter.ts; documentos-contratuais.queries.ts; visualizar-documento-contratual.actions.ts

## Foco ao chegar por aviso
O formulário fica visibility: hidden até hidratar e focus() em elemento oculto não faz nada: o hook tenta a cada quadro (teto de ~2 s a 60 fps) até pegar, e desiste se o usuário foi para outro controle.
Onde vive: use-foco-ao-destacar.hook.ts; use-foco-pendente.hook.ts; use-aviso-anunciado.hook.ts (região aria-live: a mesma ação repetida muda o texto via vez)

## RH: acompanhamento mensal
Competência é sempre o primeiro dia do mês (AAAA-MM-01); sem competência, o mês corrente. "Não se aplica" vale no mês ou sempre. O Holerite é derivado (nunca marcado à mão), pela contagem de cartões do mês (ativos menos sem movimento). O Funcionário do RH marca os seus; Líder e Admin só leem e veem também clientes sem Responsável. Histórico usa o Responsável de hoje. null = inexistente ou fora da vista do ator.
Onde vive: dtos/acompanhamento.dto.ts; ports/out/acompanhamento.repository.ts; ports/in/obter-acompanhamento-*.provider.ts

## RH: convenção coletiva
Sindicato e vigência saem do PDF na extração (ADR 0004: contrato neutro, o extrator nunca rejeita, falha vira lido:false; a convenção é pública e pode ir a serviço externo). Sobe e renova: Líder do RH e Admin; a RLS é a última barreira e a convenção nunca é alterada. Sindicato nulo no empregado = a única do Cliente. PDF em armazenamento privado, só o servidor grava; o remove compensa falha posterior do cadastro.
Onde vive: dtos/convencao.dto.ts; ports/out/extrator-de-regras.provider.ts; ports/out/convencao.repository.ts; ports/out/armazenamento-de-convencao.provider.ts

## RH: folha e cartão de ponto
Minutos de 0 a 1439 desde 00:00 (saída menor que entrada = virou o dia). Só dia com carga e não feriado aceita Abono sem batida. Dia sem batidas, Extra e Abono apaga a linha; só preenche (dia com linha não é tocado). Cartão e abono numa transação só; marcar de novo é idempotente. Sem convenção vigente a Totalização é pela legislação. Não há PDF para assinar de desligado, sem movimento ou sem apontamento. Atestado abona dias; os que caem em mês sem cartão iniciado ficam sem Abono. Só o Responsável do RH do Cliente edita.
Onde vive: dtos/folha-de-ponto.dto.ts; dtos/documento-do-cartao.dto.ts; mappers/documento-do-cartao.mapper.ts; ports/out/folha-de-ponto.repository.ts; ports/in/ler-*.provider.ts

## Auditoria (porta própria)
O main adapta a porta IN RegistrarAcao do módulo auditoria. Best-effort, só para "falha": o "sucesso" nasce no banco, por gatilho, na mesma transação da escrita.
Onde vive: ports/out/auditoria.provider.ts

## Testes de action (testes.md §3)
Integração presentation e application: o main é substituído por composição com caso de uso (ou portas OUT) falso, sem tocar Supabase.
Onde vive: *.actions.test.ts
