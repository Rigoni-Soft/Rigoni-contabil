# Regras: main (segredos), mensageria e factories do atendimento

Conhecimento que vivia em comentários dos arquivos do bloco 03. Uma entrada por tema.

## Segredo placeholder recusado em produção
O webhook de mensageria é público e usa service_role; em produção, segredo igual ao placeholder do `env.ts`/`.env.example` (publicado no repositório) permitiria forjar HMAC válido. A verificação roda antes de criar o client privilegiado e falha fechado; fora de produção o placeholder vale.
Onde vive: src/main/segredos-mensageria.factory.ts

## Adapter falso por segredo de E2E
Os e2e rodam contra deploy com mensageria real e não podem falar com a Meta. Requisição com o valor de E2E_ADAPTER_SECRET no cabeçalho usa o adapter falso (nunca envia); sem segredo configurado ou com valor errado vale o modo do ambiente. Só escolhe o adapter falso, não abre acesso.
Onde vive: src/main/segredos-mensageria.factory.ts

## service_role confinado
O client service_role só existe no factory admin; não reexportar nem passar adiante além do gateway que o consome (ADR 0001).
Onde vive: src/main/supabase-admin.factory.ts

## Cookies somente leitura em Server Component
Escrever cookie de dentro de Server Component falha; o proxy.ts renova a sessão.
Onde vive: src/main/supabase-server.factory.ts

## Auditoria como porta própria de cada módulo
O main adapta a porta IN RegistrarAcao (módulo auditoria) à porta própria (arquitetura.md 3.11) e devolve o Result real; quem chama (CriarUsuario) decide se trata como fatal. Na Transferência só a falha passa pela porta: o sucesso é auditado pelo banco na mesma transação (transferir_atendimento). Em ações sem RPC própria (envio de documento) vão as duas. É best-effort.
Onde vive: src/main/usuarios.factory.ts, ports/out/auditoria.provider.ts

## Alertas do setor e reavaliação
Um alerta aberto por Setor, Cliente e tipo; repetir renova mensagem e data. Alerta não renovado na rodada só se resolve para Clientes totalmente reavaliados: tarefa com reserva ocupada por outra tentativa (`naoReavaliado`) ou Cliente não lido mantém os alertas. Se um alerta não pôde ser gravado, nada é resolvido. Sem setor, o alerta é do Simples Nacional. Cliente sem meio de envio gera alerta ao setor dono sem buscar a guia nem reivindicar a tarefa.
Onde vive: jobs/alertas-da-rodada.ts, ports/out/alerta-setor.provider.ts

## Reserva, entrega e conclusão com token
Reserva a entrega, entrega e só então conclui; o cadastro nunca afirma entrega que não ocorreu. Conclusão e liberação provam posse pelo token (tentativa antiga não sobrescreve a recente); resultado incerto não libera; reserva expira e a rodada seguinte retoma. Reserva devolve null se outra tentativa vigente a tem ou o cadastro deixou de estar elegível.
Onde vive: ports/out/clientes-para-lembrete.provider.ts, clientes-para-parcelamento.provider.ts, jobs/alertas-da-rodada.ts

## Dias de execução dos jobs
Lembretes de documento e DAS: dias 01/05/10/15. Parcelamento PGFN: 1, 10 e 15. Envio de guia de parcelamento: 20/22/24/26/28. Fora do dia nada é lido nem enviado (`executado: false`).
Onde vive: ports/in/executar-*.provider.ts

## Atribuição de guias de parcelamento
O provedor devolve as guias do CNPJ sem dizer o parcelamento. Um só em aberto recebe todas; com vários, só o único cujo valor guardado não passa do valor da guia (atrasada pode vir com juros/multa). Valor não prova pertencimento (proteção provisória até o provedor devolver o acordo): com mais de um candidato compatível nenhum recebe (falha fechado). Ficam de fora: guia sem parcela ou candidato; reemissão de guia já entregue (mesma identidade, qualquer acordo do Cliente, inclusive quitado); parcela já entregue a acordo quitado com outra identidade ou sem; parcela que o dono já recebeu; grupo de parcelamentos de mesmo valor. Identidade da guia = parcela + valor (cliente_parcelamento_envios.identidade). Cada emissão é cobrada pelo provedor, por isso as parcelas já entregues são ignoradas.
Onde vive: jobs/atribuir-guias-parcelamento.ts, ports/out/guias-parcelamento.provider.ts

## Guias PGFN a entregar
Lista guias confirmadas sem registro de envio até a competência corrente, da mais antiga à mais nova; guia futura fica guardada e a não confirmada não entra. A reserva trava troca/remoção do PDF até a liberação pelo token; guia mudada ou detida por outra tentativa não é lida nem entregue. Na URA sem pendente, reenvia o PDF registrado na guia mais recente já entregue (nunca o anexo, que pode ter sido trocado).
Onde vive: jobs/guias-pgfn-a-entregar.ts

## Guia publicada
O PDF publicado devolve endereço temporário e o caminho do objeto; o caminho é a referência imutável da versão publicada, é o que o registro de envio guarda e só ele é reenviado (nunca escolhe entre versões do período; caminho de outro Cliente é recusado). Falha do serviço externo repete antes de devolver erro.
Onde vive: ports/out/guia-publicada.provider.ts, jobs/obter-guia-publicada.ts

## Guias fiscais
O CNPJ vem do cadastro, nunca do contato. Sem autorização vigente do Cliente: ForbiddenError; falha do provedor: ServicoExternoError. Parcelamento entrega só a guia mais atrasada. PDF em base64; competência AAAA-MM, parcela AAAAMM, vencimento AAAA-MM-DD.
Onde vive: ports/out/guias-fiscais.provider.ts

## Janela de 24h e templates
A janela de 24h conta da última mensagem recebida do contato (qualquer Atendimento do telefone). Com janela aberta usa texto do formato próprio (sem custo de template, também no e-mail); fechada, template aprovado pela Meta com variáveis {{1}}, {{2}}... e guia no cabeçalho. Variáveis em docs/pesquisa/templates-whatsapp.md.
Onde vive: mensagens/comunicacao-proativa.ts, ports/out/destinos-de-envio.provider.ts, ports/out/envio-mensagem.provider.ts

## Destinos de envio
Destinos do tipo do Setor e, sem nenhum, os de "todos os envios". Inválidos (canal sumiu do Contato) vêm com o motivo: o chamador entrega os válidos e reporta os inválidos. Sem válido não há para quem enviar.
Onde vive: ports/out/destinos-de-envio.provider.ts

## Idempotência e contrato neutro de mensageria
Contrato neutro (docs/contratos/mensageria.md): sem jargão de canal/provedor. O id da mensagem do provedor é chave de idempotência; `chaveIdempotencia` do envio é estável (id da Mensagem registrada) e repassada ao provedor quando suportado. Falha transitória de download = ServicoExternoError (provedor reenvia); mídia inexistente/recusada = ValidationError.
Onde vive: ports/in/receber-mensagem.provider.ts, receber-midia.provider.ts, ports/out/envio-mensagem.provider.ts, download-midia.provider.ts

## Anexos do Funcionário
Bucket privado próprio, separado dos documentos do Cliente; só sai por link temporário. Upload em partes: posse do objeto por reserva (true = esta tentativa é dona e pode remover se falhar; false = outra finalização ou Mensagem já o tem e NÃO pode ser removido); tipo e tamanho vêm do Storage, não do pedido. Miniatura só para imagem; inválida ou com falha é ignorada. Legenda não vale para áudio. Áudio gravado em webm é convertido para ogg/opus mono.
Onde vive: ports/out/anexos-atendimento.provider.ts, ports/out/conversor-de-audio.provider.ts, ports/in/enviar-anexo-ao-cliente.provider.ts

## Mensagem do Funcionário: gravação pendente e autoridade
Grava sob lock da linha e revalida a autoridade no perfil real (ativo; dono, Líder do Setor ou Admin); perdendo a corrida vira encerrada/sem_autoridade. A intenção é gravada pendente ANTES da entrega (sem transação aberta durante o HTTP) e fechada por finalizarEntregaDoFuncionario (entregue ou falha, idempotente); nunca é apagada. Só Mensagem de Funcionário nasce pendente. Mensagem do contato/URA: duplicada se o idExterno já existe; encerramento que vence descarta o objeto guardado.
Onde vive: ports/out/atendimento.repository.ts

## Transferência, assunção e fila
Transferência recusada se dono ou Setor mudaram entre leitura e gravação; conflito se o destinatário dirigido deixou de ser elegível. Assumir é atômico, o primeiro vence, e grava evento e auditoria na mesma transação. Espera dirigida (Simples Nacional: Responsável ou Líder); null = espera do Setor. Sem destinatário só a Recepção tem espera comum; fora dela é supervisão. Fila mostra `filaDesde` + `espera` (mm:ss; h:mm:ss a partir de 1h).
Onde vive: ports/out/atendimento.repository.ts, ports/in/transferir-atendimento.provider.ts, ports/in/listar-fila.provider.ts

## Permissões de leitura de Atendimento
Dono com Atendimento em andamento responde e transfere; Líder do Setor e Admin leem em supervisão (e encerram). Supervisão da equipe: só Líder e Admin. Feriados estaduais/municipais: só Admin lê, cadastra e remove. Cadastrar contato da URA: só Recepção dona do Atendimento; o banco reconfere.
Onde vive: ports/in/obter-conversa.provider.ts, listar-atendimentos-da-equipe.provider.ts, gerenciar-feriados.provider.ts, ports/out/contato-ura.provider.ts

## Encerramento por silêncio
Encerra Atendimentos com Funcionário cuja última Mensagem do cliente é do corte ou anterior (a do Funcionário não conta), com o ator na auditoria. É uma RPC só: `falhas` é sempre 0 e a falha volta como erro (502).
Onde vive: ports/in/encerrar-por-silencio.provider.ts, ports/out/atendimento.repository.ts

## Cadastro de contato pela URA
Passo 1: a Recepção digita o CNPJ e confere o Cliente. Passo 2: o número vira Contato (setor URA, Recepção dona). Resultados: existente (número já é Contato do Cliente), email_em_uso (de outro Contato do Cliente), em_outro_cliente (não cria, ficaria ambíguo).
Onde vive: ports/in/cadastrar-contato-ura.provider.ts

## Alteração contratual
`numero` identifica a alteração (único por Cliente; a data pode repetir); o contrato social não tem numero nem data (AAAA-MM-DD). Lista: contrato social primeiro, depois alterações por número decrescente. O link do documento é de curta duração, só para o provedor buscar o arquivo.
Onde vive: ports/in/obter-conversa.provider.ts, ports/out/documentos-contratuais.provider.ts
