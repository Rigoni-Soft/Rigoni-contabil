# Job de encerramento automático (#167): ativação e operação

Rota: `GET|POST /api/jobs/encerramento`, agendada em `vercel.json` (`0 11 * * *`, 1 vez por dia, 08h
em São Paulo). Substitui por completo o antigo job de Inatividade (#73).

## Regra

Encerra o Atendimento **em atendimento** (com Funcionário) cuja última Mensagem do **cliente** tem
23h50 ou mais. A Mensagem do Funcionário não reinicia a contagem. O relógio é corrido: noite, fim de
semana e feriado contam, e o job roda também fora do expediente. Quem está na espera (sem
Funcionário) não entra. O encerramento é o comum (`encerrar_atendimento`), auditado com a URA como
ator (`atendimento.encerrar`, no Setor do Atendimento). Não avisa o cliente nem reabre: quem volta
abre um Atendimento novo pela URA.

> **Hobby:** o cron é diário, então um Atendimento vencido às 23h50 fecha na próxima rodada (até
> ~24h depois do prazo). Para encerrar perto das 23h50, subir para o Pro e agendar com mais
> frequência (o job é idempotente e barato: uma RPC, `encerrar_atendimentos_por_silencio`).

## Gate de ativação

Autenticar (`Authorization: Bearer $CRON_SECRET`) **não** autoriza executar. O job só altera
Atendimentos com `ENCERRAMENTO_AUTOMATICO=ligada`; desligada (padrão), a rota responde
`200 { "ativa": false }` sem tocar no banco. Não fala com o cliente, então não exige mensageria
real.

## Resposta

`200 { "encerrados": n, "falhas": 0 }`; falha do banco responde `502`.
