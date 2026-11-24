import { encerramentoAutomaticoAtivo, makeEncerrarPorSilencio } from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

export const POST = jobAgendadoWebhook(encerramentoAutomaticoAtivo, () =>
  makeEncerrarPorSilencio().execute(),
);
export const GET = POST;
