import {
  lembretesAutomaticosAtivos,
  makeExecutarEnvioGuiaParcelamento,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

export const POST = jobAgendadoWebhook(lembretesAutomaticosAtivos, () =>
  makeExecutarEnvioGuiaParcelamento().execute(),
);
export const GET = POST;
