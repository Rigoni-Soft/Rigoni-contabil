# Regras do atendimento e da auditoria (presentation)

Conhecimento que vivia em comentários de código. Uma entrada por tema.

## Polling da conversa e das listas
A conversa aberta é relida a cada 5 s com atividade recente e a cada 15 s parada; Fila, Meus atendimentos e supervisão leem a cada 15 s. Realtime (`*.realtime.ts`, arquitetura.md 4.2) entra quando o atraso incomodar. A leitura de "minha Fila" desiste só quando negada (Admin sem Setor, sessão expirada); erro de rede tenta no próximo ciclo.
Onde vive: src/modules/atendimento/presentation/view-models/conversa/conversa.queries.ts, fila/fila.queries.ts, meus-atendimentos/meus-atendimentos.queries.ts

## Janela recente e histórico da conversa
O polling devolve só a janela recente. O histórico já aberto é mantido só se as janelas se sobrepõem; sem Mensagem em comum a janela nova vale sozinha. Página de "ver anteriores" só entra se ainda é o começo da conversa; se o polling trocou a janela, é descartada. O cursor é a Mensagem mais antiga (data e, no empate, id).
Onde vive: conversa.presenter.ts, conversa.presenter.spec.ts

## Links de anexo
Cada leitura gera links assinados novos; o link anterior é mantido até faltar `margemMs` para expirar, para as imagens não recarregarem. A renovação é em lote, passa de novo pela autorização do servidor, e falhar não derruba a leitura. Objeto ausente não ocupa as vagas do lote nem é pedido a cada rodada.
Onde vive: conversa.presenter.ts, conversa.queries.ts, conversa.schema.ts

## Envio de anexo
Imagem, documento e áudio sobem em partes direto ao Storage (ADR 0007; Server Action não passa de 4,5 MB na Vercel) e só então o servidor confere e entrega. O áudio gravado não é arquivo pendente. Arquivo pendente é estado do cliente (Zustand, arquitetura.md 4.7) compartilhado pelo campo de resposta e pela conversa. Trocar o arquivo no meio do envio não pode limpar o novo.
Onde vive: conversa.store.ts, use-compositor.hook.ts, conversa.queries.ts

## Gravação de áudio
Usa o primeiro formato que o navegador grava e o WhatsApp aceita sem conversão; sem nenhum, grava webm e o servidor converte (ADR 0006). Mono, como a mensagem de voz do WhatsApp exige. Para sozinha ao atingir duração ou tamanho e fica "pronto" aguardando confirmação. Microfone liberado ao parar, descartar e sair da tela.
Onde vive: use-gravador-audio.hook.ts, use-gravacao-no-compositor.hook.ts

## Cadastrar número como contato do Cliente
Só a Recepção dona do Atendimento, com número sem contato. Passo 1 confirma o Cliente do CNPJ (não grava); passo 2 grava o contato. Criado e já existente são sucesso; número em outro Cliente e e-mail repetido não cadastram e pedem atenção. E-mail em branco vale "sem e-mail"; formato conferido no schema e de novo no caso de uso.
Onde vive: conversa.schema.ts, use-contato-ura.hook.ts

## Conversa de outro usuário e transferência
Líder do Setor ou Admin lendo conversa alheia não responde nem transfere. Transferido, o Funcionário perde a conversa e volta ao início; encerrar pede confirmação. Fila dirigida: só o destinatário assume. A Fila sem Setor é a do próprio usuário (mesma chave de cache para tela, barra lateral e aviso global).
Onde vive: use-cabecalho-conversa.hook.ts, use-acoes-conversa.hook.ts, fila/fila.presenter.ts, fila/fila.queries.ts

## Jobs agendados
Autenticar (CRON_SECRET) não autoriza executar: a flag do job manda e, desligada, nada é lido, enviado ou alterado. Falha por item não vira 200. O cron chama em dias fixos e o próprio job reconfere o dia em São Paulo (guia de parcelamento 20/22/24/26/28; documento e DAS 01/05/10/15; PGFN 01/10/15). Encerramento por silêncio: cliente sem escrever há 23h50.
Onde vive: presentation/webhooks/*.webhook.ts

## Webhook do WhatsApp
Qualquer status diferente de 200 faz a Meta reenviar por até 7 dias (docs/contratos/mensageria.md): falha permanente é registrada e confirmada com 200; só falha transitória devolve 502. Tipo sem tratamento (vídeo, figurinha, localização) chega como texto vazio e reabre o menu. Objetos de mídia são tolerantes a campo faltando. Statuses caem sem efeito.
Onde vive: whatsapp.webhook.ts, whatsapp.webhook.test.ts

## Auditoria: fuso e filtro de período
Fuso fixo America/Sao_Paulo (UTC-3, sem horário de verão desde 2019), offset literal para ser determinístico em browser, servidor e CI. Filtro e exibição usam o mesmo fuso, senão um registro perto da meia-noite aparece num dia e é filtrado em outro (caso 29/09 23:30 SP = 30/09 02:30 UTC). Período exige as duas pontas ou nenhuma.
Onde vive: listar-registros.use-case.ts, feed.presenter.ts, feed.schema.ts

## Auditoria: escrita e filtros
Só ações que mudam estado são registradas, nunca leituras. A RPC registrar_acao_auditoria só aceita service_role (migration 20260924190000_usuarios_e_auditoria.sql) e a tabela não tem policy de INSERT: ninguém fabrica evento pela Data API. Ator é uuid (z.guid, não z.uuid: a coluna aceita qualquer 8-4-4-4-12). Resultado "falha_compensacao" é a falha da própria compensação (conta pode ficar órfã). Porta de sessão própria: módulos não se importam (arquitetura.md 3.11). initialData só vale para o filtro vazio (arquitetura.md 4.9).
Onde vive: registro-acao.repository.ts, registro-acao.builder.ts, resultado-acao.vo.ts, feed.schema.ts, use-feed.hook.ts

## Server files sem tipo de retorno
*.server.ts de presentation não declara tipo de retorno: nomear Result/DTO do módulo violaria "presentation não importa domain/infra"; o shape flui por inferência.
Onde vive: presentation/view-models/*/*.server.ts
