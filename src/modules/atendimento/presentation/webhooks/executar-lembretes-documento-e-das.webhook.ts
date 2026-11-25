import {
  lembretesAutomaticosAtivos,
  makeExecutarLembretesDocumentoEDas,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

export const POST = jobAgendadoWebhook(lembretesAutomaticosAtivos, () =>
  makeExecutarLembretesDocumentoEDas().execute(),
);
export const GET = POST;
