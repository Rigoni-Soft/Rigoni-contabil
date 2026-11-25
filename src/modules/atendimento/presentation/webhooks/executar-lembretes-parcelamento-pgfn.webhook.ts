import {
  lembretesParcelamentoPgfnAtivos,
  makeExecutarLembretesParcelamentoPgfn,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

export const POST = jobAgendadoWebhook(lembretesParcelamentoPgfnAtivos, () =>
  makeExecutarLembretesParcelamentoPgfn().execute(),
);
export const GET = POST;
