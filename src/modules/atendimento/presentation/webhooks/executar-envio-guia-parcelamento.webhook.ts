import {
  lembretesAutomaticosAtivos,
  makeExecutarEnvioGuiaParcelamento,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// O cron chama só nos dias 20/22/24/26/28; o próprio job reconfere o dia (São Paulo).
export const POST = jobAgendadoWebhook(lembretesAutomaticosAtivos, () =>
  makeExecutarEnvioGuiaParcelamento().execute(),
);
export const GET = POST;
