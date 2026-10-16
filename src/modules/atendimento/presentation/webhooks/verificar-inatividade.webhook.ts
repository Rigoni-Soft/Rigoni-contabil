import { inatividadeAutomaticaAtiva, makeVerificarInatividade } from "@/main/atendimento.factory";

import { jobAgendadoWebhook } from "./job-agendado.webhook";

// A cada poucos minutos: a URA verifica a inatividade.
export const POST = jobAgendadoWebhook(inatividadeAutomaticaAtiva, () =>
  makeVerificarInatividade().execute(),
);
export const GET = POST;
