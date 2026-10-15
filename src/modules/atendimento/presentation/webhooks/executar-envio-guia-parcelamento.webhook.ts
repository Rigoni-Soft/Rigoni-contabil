import {
  lembretesAutomaticosAtivos,
  makeExecutarEnvioGuiaParcelamento,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// Chamada diária: o próprio job decide se hoje é dia 20/22/24/26/28 (São Paulo).
export const POST = jobAgendadoWebhook(lembretesAutomaticosAtivos, () =>
  makeExecutarEnvioGuiaParcelamento().execute(),
);
export const GET = POST;
