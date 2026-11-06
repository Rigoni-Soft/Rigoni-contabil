import {
  lembretesParcelamentoPgfnAtivos,
  makeExecutarLembretesParcelamentoPgfn,
} from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// Chamada diária: o próprio job decide se hoje é dia 01/10/15 (São Paulo).
export const POST = jobAgendadoWebhook(lembretesParcelamentoPgfnAtivos, () =>
  makeExecutarLembretesParcelamentoPgfn().execute(),
);
export const GET = POST;
