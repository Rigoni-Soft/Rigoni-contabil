# Atendimento: infraestrutura e presentation

Regras que viviam em comentários nos gateways, repositórios e view-models do Atendimento.

## Client service_role nos gateways dos jobs e do webhook
Os gateways de guias PGFN, parcelamentos, identificação de contato, sessão da URA e o repositório do Atendimento usam o client service_role: job e webhook não têm sessão de usuário e a tabela do Atendimento não tem policy para usuário logado. ADR 0001.
Onde vive: src/modules/atendimento/infra/gateways/*.gateway.ts, src/modules/atendimento/infra/repositories/atendimento.repository.ts.

## Feriados: client da sessão do Admin
Com o client da sessão do Admin valem a RLS e a auditoria do banco; com o service_role (webhook) só `listarDatas` é usado. As policies exigem `acesso_liberado()`: `meu_papel()` sozinho deixaria passar o Admin com troca de senha obrigatória pendente.
Onde vive: infra/repositories/feriado.repository.ts, feriado.repository.test.ts.

## Guia PGFN: bucket privado e isolamento por Cliente
A guia anexada fica no bucket privado dos acordos em `${clienteId}/guias-pgfn/...`; a guia de outro Cliente nunca é lida. O envio PGFN (PDF do escritório) nunca vai ao provedor fiscal e não pode excluir nem consumir guia da Receita da mesma parcela; origem nula (digitado à mão) conta como Receita.
Onde vive: infra/gateways/supabase-guias-pgfn.gateway.ts (BUCKET_DOS_ACORDOS, guiaPertenceAoCliente), supabase-parcelamentos-do-cliente.gateway.ts.

## Identificação de contato por telefone
O banco devolve uma linha por Cliente; mais de uma linha é número ambíguo. A checagem de existência não tem linha de Cliente a mapear e não passa por Row DTO.
Onde vive: infra/gateways/supabase-identificacao-contato.gateway.ts.

## Sessão da URA: telefone nunca em claro
A chave da sessão é um HMAC do telefone (número de telefone tem pouca entropia, hash puro seria reversível). Sem job agendado, a leitura varre as sessões expiradas de todos os números: é a única limpeza.
Onde vive: infra/gateways/supabase-sessao-atendimento.gateway.ts.

## Upload TUS do anexo
Partes de 6 MB (exigência da TUS do Supabase Storage). O token é o do usuário logado: sem a policy de INSERT da migration 20261014130000_mensagens_anexos_e_entrega.sql o Storage recusa. Cada parte repete sozinha antes de devolver erro. Uma pasta por envio mantém o nome original no link com `download`; o tipo vai sem parâmetros porque o bucket confere contra lista fechada. A Server Action só recebe caminho, nome, legenda e miniatura (até 256 KB) porque o corpo de uma Server Action não passa de 4,5 MB na Vercel.
Onde vive: infra/gateways/tus-upload-de-anexo.gateway.ts (PARTE_BYTES, ESPERAS_ENTRE_TENTATIVAS_MS), presentation/view-models/conversa/anexo-em-partes.upload.ts, conversa.actions.ts.

## Colunas do Cliente nos jobs
As RPCs de leitura dos jobs devolvem só colunas do Cliente; quem recebe a guia vem dos Destinos de envio (`destinos_de_envio_do_job`).
Onde vive: infra/mappers/linha-cliente-do-job.mapper.ts.

## Repositório do Atendimento
Os quatro campos do anexo nascem juntos (CHECK da tabela). Cada Setor tem um só Líder; se o banco devolver dois, falha em vez de escolher. Responsável desativado não recebe: cai no Líder. O nome do Contato é enfeite do painel: falha na busca mostra o Atendimento sem nome. Quem escreve é o Contato cujo número bate com o do Atendimento, achado pela função única do banco. A janela de histórico lê uma mensagem a mais que o pedido (diz se há mais) e o cursor é estritamente anterior (data menor, ou mesma data com id menor).
Onde vive: infra/repositories/atendimento.repository.ts (COLUNAS_DA_MENSAGEM, filtroDeMensagensEstritamenteAnterioresA, nomeOuNenhum).

## Privilégios das RPCs do job de envio
`anon` e `authenticated` não têm EXECUTE nas RPCs do job (o baseline concede EXECUTE a authenticated por default privileges, então o REVOKE de PUBLIC não basta). A RPC que escreve no sino é SECURITY DEFINER: só service_role e o trigger a chamam.
Onde vive: infra/repositories/envios-do-job-privilegios.repository.test.ts.

## Concorrência do Atendimento
Mensagens recebidas ou do Funcionário entram sob o lock da linha do Atendimento e reavaliam status e autoridade ali; o encerramento automático (corte 23h50) idem. Os testes de concorrência usam duas conexões e só seguem após provar que a sessão espera lock.
Onde vive: infra/repositories/atendimento-mensagens-concorrencia.repository.test.ts, atendimento-encerramento-automatico-concorrencia.repository.test.ts.

## Aviso do Atendimento (leitor de tela, som, contador)
O som avisa quem ouve; o texto em região `status` avisa o leitor de tela (WCAG 4.1.3) para cliente novo na espera e cliente que escreve de novo em conversa não aberta. A primeira leitura de cada lista é silenciosa; quem sai da espera não conta. O leitor só reanuncia texto que muda: aviso repetido ganha um espaço invisível alternado. Na tela Atendimento a própria tela anuncia e o menu só guarda a base. Dois sons na mesma leitura viram um. O contador do menu só lê o cache (quem consulta e faz polling de 15 s é o aviso global e a tela Atendimento) e fica falso no servidor e na hidratação para o HTML bater. Líder ou Admin supervisionam: leem Atendimentos de outros e a espera dirigida, sem sinal de urgência.
Onde vive: presentation/view-models/atendimento-central/use-anuncio-da-lista.hook.ts, use-anuncio-do-menu.hook.ts, use-som-da-lista.hook.ts, use-pendentes-do-menu.hook.ts, use-aviso-global.hook.ts, use-atendimento-central.hook.ts.

## Estado da tela e foco
Aba aberta e conversa no centro ficam no store (seleção do cliente, arquitetura.md 4.7) porque lista, chat e ações dependem delas. A primeira leitura da conversa aberta não vem do servidor (sem rota) e só a carga inicial é guardada. O foco vai ao chat ao abrir conversa e volta à lista ao fechar, para teclado e leitor de tela não perderem o lugar.
Onde vive: atendimento-central.store.ts, use-conversa-aberta.hook.ts, use-foco-da-tela.hook.ts.
