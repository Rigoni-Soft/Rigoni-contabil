import { encerramentoAutomaticoAtivo, makeEncerrarPorSilencio } from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// Chamada periódica: encerra o Atendimento cujo cliente está há 23h50 sem escrever.
export const POST = jobAgendadoWebhook(encerramentoAutomaticoAtivo, () =>
  makeEncerrarPorSilencio().execute(),
);
export const GET = POST;
