import { makeAutenticacaoJob } from "@/main/atendimento.factory";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Rota de job do agendador (Vercel Cron chama com GET; POST serve a outros agendadores).
// Autenticar (CRON_SECRET) não autoriza executar: a flag do job manda, e desligado nada é lido,
// enviado nem alterado. Falha por item não passa por 200: o agendador e o
// monitoramento veem a rodada falha, e o resumo vai no corpo.
export function jobAgendadoWebhook(
  ativo: () => boolean,
  executar: () => Promise<Result<{ falhas: number }, AppError>>,
) {
  return async (request: Request): Promise<Response> => {
    if (!makeAutenticacaoJob().autorizado(request.headers.get("authorization"))) {
      return new Response("Não autorizado.", { status: 401 });
    }
    if (!ativo()) return Response.json({ ativa: false });
    const resultado = await executar();
    if (!resultado.ok) return new Response(resultado.error.message, { status: 502 });
    return Response.json(resultado.value, { status: resultado.value.falhas > 0 ? 500 : 200 });
  };
}
