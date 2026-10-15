import {
  lembretesAutomaticosAtivos,
  makeExecutarLembretesDocumentoEDas,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// Chamada diária: o próprio job decide se hoje é dia 01/05/10/15 (São Paulo).
export const POST = jobAgendadoWebhook(lembretesAutomaticosAtivos, () =>
  makeExecutarLembretesDocumentoEDas().execute(),
);
export const GET = POST;
