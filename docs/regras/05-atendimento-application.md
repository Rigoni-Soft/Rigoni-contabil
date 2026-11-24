# Regras do Atendimento (application, domain e infra)

Conhecimento que vivia em comentários e agora mora aqui. Cada tema aponta onde a regra vive no código.

## Menu da URA e pedido de atendente
No menu e na lista de Setores só vale o pedido explícito de uma pessoa; "ajuda" e "dúvida" são dúvida de uso do menu. Num número não reconhecido, "suporte", "ajuda" e "dúvida" também pedem uma pessoa. "Falar com atendente" é sempre a última opção, e "atenção"/"atencao" valem o mesmo. Uma só lista define o menu: a posição é o número digitado e `guia` marca as opções cujo PDF vem do provedor fiscal.
Onde vive: src/modules/atendimento/application/use-cases/receber-mensagem.use-case.ts (opções do menu e padrões de pedido de atendente).

## Quem já tem Atendimento e resposta automática
Quem já tem Atendimento em andamento continua nele e a URA não recomeça. Não há resposta automática: quem responde é o Funcionário. Sem confirmar a empresa nenhum documento é oferecido e a recepção decide. O resumo que a recepção lê ao assumir (`atendimentos.resumo_ura`) tem origem sempre URA.
Onde vive: receber-mensagem.use-case.ts

## Fora do expediente
Fora do expediente a URA só avisa o horário: sem menu, documento, sessão ou Atendimento. Sem a lista de feriados não dá para afirmar se está aberto nem a data da volta; o erro faz a Meta reenviar. Expediente: dia útil (não sábado/domingo/feriado), 8h às 18h, horário de São Paulo; datas civis circulam como "AAAA-MM-DD" e UTC só é aritmética de dias. O offset é fixo -03:00 porque o Brasil não tem horário de verão desde 2019; se voltar, derivar a abertura do FUSO. O tempo de expediente entre dois instantes ignora noite, fim de semana e feriados. Feriados móveis derivam da Páscoa (algoritmo anônimo gregoriano): Carnaval -48/-47, Sexta-feira Santa -2, Corpus Christi +60.
Onde vive: domain/services/expediente.service.ts (`HORA_DE_ABERTURA`, `HORA_DE_FECHAMENTO`, `DESLOCAMENTO_DE_SAO_PAULO`, `DIAS_DA_PASCOA_ATE_*`, `pascoaGregoriana`); remoção de feriado: a auditoria `feriado.remover` nasce no banco, na mesma transação do DELETE (remover-feriado.use-case.ts).

## Identificação de número sem Contato
Número sem Contato: "já é cliente?" → CNPJ → recepção. Mesmo com CNPJ o número não vira Contato (já foi buscado em todos os Clientes), então o fim é sempre a recepção; CNPJ inexistente tem 1 nova tentativa. Pedido de atendente em qualquer etapa vai à recepção; sessão ausente/expirada/de outro fluxo ou "menu" recomeça pela pergunta. Trocar de etapa zera o contador de respostas inválidas (cada etapa tem o seu); sem o contador o cliente ficaria preso em resposta inválida, então ao passar do limite vai à recepção. O aviso é enviado antes de abrir o Atendimento: se o envio falhar e a Meta reenviar, não nasce Atendimento duplicado. O Atendimento espera no Setor e o cliente é avisado sem posição.
Onde vive: receber-mensagem.use-case.ts; avisos em domain/services/aviso-fila.service.ts.

## Escolha de Setor
Número da página = setor; "mais" = próxima página; "0" ou pedido por uma pessoa = recepção; outra coisa é resposta inválida. A lista é refeita a cada resposta a partir do regime atual: se o regime mudar entre mostrar e responder, o número pode apontar outro Setor. Janela rara, aceita como a do ADR 0012. A Mensagem registrada é o nome do setor (ou o rótulo da recepção), não o dígito. A Recepção fica fora da lista (saída de quem não sabe o setor) e o Simples Nacional só aparece para Cliente do Simples Nacional/MEI, a mesma trava da Transferência. A numeração recomeça em 1 a cada página.
Onde vive: receber-mensagem.use-case.ts; domain/services/setores-da-ura.service.ts; transferencia.service.ts.

## Menu de documentos: sessão e hash da lista
A sessão guarda só a posição (etapa/modo/página); nada do Cliente é persistido e os documentos são relidos a cada mensagem. "1".."5" é escolha de menu; outro texto reabre a saudação. A sessão guarda também um hash da lista de alterações exibida: se a lista mudar antes da escolha, nada é entregue e a lista nova é mostrada (o número digitado poderia apontar outro documento jurídico). Hash não criptográfico (cyrb53, 53 bits): só detecta mudança; a camada de aplicação não importa `crypto` (infra). Pedido "ambos" sem alterações ainda entrega o contrato; alterações vêm do gateway por nº decrescente. A sessão só encerra depois de entregar, para a Meta reenviar se o envio falhar; falhar depois da entrega faria duplicar o documento, e a sessão que sobrar expira em 10 min ou some com "menu".
Onde vive: receber-mensagem.use-case.ts (`cyrb53`, `impressaoDaLista`, `limparSessaoIgnorandoFalha`, `COMANDO_MENU`, `COMANDO_MAIS`); domain/services/paginacao.service.ts (numeração, "01"/"007" não valem, página fora do intervalo vira a mais próxima); domain/services/documento-contratual.service.ts (nomes ao cliente); DTO sessao-atendimento-row.dto.ts (`modo`/`lista` só em "alteracao", `pagina` em "alteracao" e "setor", `invalidos` nas etapas de identificação e "setor"; as constraints do banco garantem os pares).

## Falha do provedor fiscal na guia
O provedor fiscal é falha esperada por Cliente (sem autorização, fora do ar): o contato é avisado e a mensagem fica resolvida, em vez de a Meta reenviar para sempre. Só falhar o envio do PDF/aviso devolve erro. Sem autorização é esperado; o resto (Cliente sumido, CNPJ inválido, provedor fora do ar) é problema do sistema e precisa de rastro no log, sempre só a mensagem e sem CNPJ (o erro inteiro poderia levar o CNPJ ao log). DAS e parcelamento seguem o processo do job: confere o banco, responde ao contato e só chama o provedor quando há o que entregar.
Onde vive: receber-mensagem.use-case.ts; infra/gateways/guias-fiscais.gateway.ts (só o Simples Nacional e o MEI têm parcelamento ordinário; a emissão é direta e o provedor consulta a autorização só se falhar; a CND vem de fonte própria; painel e URA entregam uma guia só, a mais atrasada, até o envio de todas).

## Mídia do cliente
Só entra num Atendimento em andamento; sem ele nada é baixado e a URA pede texto. Mídia que o provedor não entrega mais, ou fora do limite/tipo, vira aviso do sistema na conversa; falha transitória devolve erro para o provedor reenviar. Idempotente pelo id da mensagem no provedor. Só "registrada" deixa o arquivo na conversa; se falhou, já havia a Mensagem (reentrega em paralelo) ou o Atendimento fechou, o arquivo guardado é removido. Fechamento que vence a corrida equivale a não haver Atendimento aberto.
Onde vive: application/use-cases/receber-midia.use-case.ts

## Transferência
O Atendimento vai para a espera do Setor de destino; no Setor Simples Nacional fica dirigido ao Responsável do Cliente ou ao Líder (sem Líder ativo, cai na espera do Setor). Ninguém é escolhido pelo sistema: quem atende assume. A Recepção é exceção: todos respondem por todo cliente, então a espera é comum. O Simples Nacional só recebe Cliente do Simples Nacional/MEI. Depois de transferido, falhar não desfaz nada: o erro diz que o Atendimento já está com o destino e o cliente não foi avisado. O resumo tem no máximo 1000 caracteres, igual à CHECK de `transferencias.resumo`.
Quem vê e encerra: o dono, o Líder do Setor onde o Atendimento está, ou o Admin (Líder e Admin veem os dos outros em leitura de supervisão). Quem responde, envia arquivo, reage e transfere: só o dono; sem dono (espera), ninguém. Destinos possíveis: qualquer Setor do Cliente menos o atual.
Onde vive: application/use-cases/transferir-atendimento.use-case.ts; domain/services/transferencia.service.ts.

## Contato URA
Só a Recepção cadastra o número como Contato URA, e só o dono do Atendimento dela; Líder e Admin em supervisão não. O banco confere de novo (função `cadastrar_contato_ura`, que roda com a sessão do usuário e audita); a leitura do Cliente usa service_role porque a Recepção não lê `clientes` direto (só o Admin). E-mail opcional: em branco vira null; senão aparado e em minúsculas como o banco grava; `undefined` = e-mail inválido. Concorrência: os índices únicos do Cliente seguram e a função devolve o que a outra chamada criou, sem vazar o erro do índice.
Onde vive: domain/services/contato-ura.service.ts (`EMAIL_VALIDO`); infra/gateways/supabase-contato-ura.gateway.ts; testes supabase-contato-ura*.test.ts.

## Janela da conversa
A conversa é lida e atualizada por janela: Mensagens mais recentes, histórico sob demanda a partir de cursor estável (data e, no empate, id). Sem isso o limite de linhas da API (`max_rows`) cortaria as Mensagens novas de uma conversa longa. A renovação de links aceita um lote limitado de Mensagens (as que estão vencendo).
Onde vive: domain/services/janela-da-conversa.service.ts

## Encerramento automático
Relógio corrido, sem expediente: o Atendimento cuja última Mensagem do cliente é do instante limite (ou anterior) já passou de 23h50 e se encerra. O ator na auditoria é um ator de sistema da URA (a tabela não exige perfil).
Onde vive: domain/services/encerramento-automatico.service.ts

## Guia guardada
A guia fica no Storage em cliente/id/AAAAMM-hash; a chave é estável, então o reenvio reencontra o PDF sem chamar o provedor fiscal. O DAS é guardado pelo mês do envio; parcela é AAAAMM. O nome do arquivo não vira caminho e uma guia reemitida com outros bytes nunca sobrescreve a entregue. Upload 409 = objeto já existe com os mesmos bytes (o caminho leva o hash). Não se apaga nenhum objeto depois de publicado: outra tentativa concorrente pode usar o mesmo, e só o registro do envio diz qual foi entregue (limpar por data, só dos não referenciados, se o volume pesar). A assinatura vale 7 dias (o e-mail pode ser aberto depois). O caminho nasce em `${clienteId}/...`: o de outro Cliente nunca é assinado.
Onde vive: domain/services/guia-guardada.service.ts (`aaaamm`); infra/gateways/supabase-guia-publicada.gateway.ts (`pertenceAoCliente`, `STATUS_OBJETO_JA_EXISTE`; testado em supabase-guia-publicada.gateway.spec.ts).

## Anexos e documentos no Storage
Bucket `anexos-atendimento` é privado e sem policy: o arquivo só sai por link temporário do servidor; só quem pode agir no Atendimento em andamento grava na pasta dele. O caminho usa só o que o Storage aceita (sem acento/espaço); o nome original fica na Mensagem e no envio. Uma pasta por envio, e o link com `download` entrega o nome original; o token assina só o caminho, então sem `download` serve para ver. Anexo sem link aparece sem arquivo na conversa; objeto inexistente é indistinguível de falha de rede e vira "não chegou" (quem chama pede o envio de novo). Documentos contratuais: a Meta busca o arquivo logo após o envio, 5 min de link bastam; as policies de documentos-clientes só abrem para o Admin, por isso service_role.
Onde vive: infra/gateways/supabase-anexos-atendimento.gateway.ts; supabase-documentos-contratuais.gateway.ts.

## service_role nos gateways (ADR 0001)
Os gateways de jobs e de WhatsApp usam o client service_role porque quem escreve pelo WhatsApp ou o job não tem sessão de usuário. Cada job grava e resolve só os alertas da própria origem; o cadastro de Destino inválido não resolve na hora e o alerta segue aberto até a rodada seguinte.
Onde vive: infra/gateways/supabase-alerta-setor, supabase-cliente-cnpj, supabase-clientes-*, supabase-destinos-de-envio.gateway.ts.

## Erros da Meta e do SMTP: o que repete
Cloud API (Meta): 400 (número sem WhatsApp, janela de 24h, parâmetro inválido), 404 de mídia expirada e 400 de id inválido não melhoram ao repetir: ValidationError. 401/403, 429, 5xx e rede: ServicoExternoError, e a Meta reenvia. Áudio não tem legenda; imagem e documento têm `caption`. O PDF sobe como mídia e o envio de documento referencia o id. O corpo da requisição é compartilhado entre adapter real e falso para não divergirem. Códigos: 133010, 131047, 131026 = ValidationError (400); 130429 (429), 190 (401), 131000 (500) = ServicoExternoError. SMTP (Gmail, senha de app; `enderecoRecusado`): endereço recusado (EENVELOPE ou 550-553) = ValidationError; o resto = ServicoExternoError. O Gmail não deduplica: falha após o aceite pode repetir o e-mail na retentativa. A assinatura do webhook é `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 do corpo cru com o segredo do app. Autenticação de job: `Authorization: Bearer <segredo>` (como o Vercel Cron); sem segredo configurado ninguém é autorizado.
Onde vive: infra/gateways/envio-mensagem-whatsapp.gateway.ts, download-midia-whatsapp.gateway.ts, envio-email-smtp.gateway.ts, corpo-cloud-api.gateway.ts, hmac-autenticacao-webhook.gateway.ts, bearer-autenticacao-job.gateway.ts.

## Adapters falsos e indisponível
Os falsos (padrão em dev/e2e) não falam com o provedor e reproduzem os erros da Cloud API; `falhas` mapeia telefone a código de erro. Listas em memória sem limite, somem a cada restart; trocar por tabela se alguém precisar auditar o que foi enviado fora de testes. Mídias de teste: ogg/opus de ~0,6 s, Word e Excel mínimos (planilha "Balancete" com duas linhas). Em produção sem adapter real de e-mail, o adapter indisponível falha de forma explícita (o falso marcaria o DAS como enviado sem ninguém receber); não é transitório, então o job não repete e vira alerta do setor.
Onde vive: infra/gateways/*-falso.gateway.ts; envio-email-indisponivel.gateway.ts.

## ffmpeg
Converte para ogg/opus mono (formato da mensagem de voz do WhatsApp), entrada e saída por pipe, sem disco. Usa o binário do ambiente ou o de `caminho`; sem ele falha com mensagem clara e nada se perde (ADR 0006). `caminho` é função para só resolver/descomprimir quando há o que converter. O binário comprimido (gerado no build por scripts/comprimir-ffmpeg.mjs) é descomprimido uma vez em /tmp, escrevendo ao lado e renomeando para que invocações simultâneas nunca executem arquivo pela metade. ffmpeg que morre antes de ler tudo fecha o pipe e o erro vem pelo `close`.
Onde vive: infra/gateways/ffmpeg-conversor-de-audio.gateway.ts; resolver-ffmpeg.gateway.ts.

## DTOs de linha (infra/dtos)
As linhas espelham tabelas e RPCs do banco (`abrir_atendimento`, `anexar_mensagem_atendimento`, `transferir_atendimento`, `encerrar_atendimento`, `assumir_atendimento`, `registrar_mensagem_recebida` com o veredito do lock, `cadastrar_contato_ura` com `status` que decide a tela). `feriados.data` é `date` AAAA-MM-DD e `atendimento_sessoes` já têm o formato do domínio, então não há mapper. CNPJ: 14 caracteres [0-9A-Z] sem máscara. Quem escreve a mensagem é achado pelo banco (`contato_por_telefone_no_cliente`).
Onde vive: src/modules/atendimento/infra/dtos/*.dto.ts

## Testes de integração do Atendimento
Requerem `npx supabase start` local (migrations + seed). Os destrutivos nunca rodam contra base remota. Select sem ORDER BY não tem ordem de inserção: os avisos novos saem por id. Destinos: tipo específico antes de "todos", telefone com DDI, janela de 24h pela chave nacional; `contato_ausente` avisa o Líder e o Responsável do Setor, uma vez por abertura, nunca o Admin.
Onde vive: infra/gateways/*.test.ts
