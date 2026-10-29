import { makeAutenticacaoJob } from "@/main/atendimento.factory";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Rota de job do agendador (Vercel Cron chama com GET; POST serve a outros agendadores).
// Autenticar (CRON_SECRET) não autoriza executar: a flag do job manda, e desligado nada é lido,
// enviado nem alterado. Falha por item (`falhas` no resumo) não passa por 200: o agendador e o
// monitoramento veem a rodada falha, e o resumo vai no corpo.
export function jobAgendadoWebhook(
  ativo: () => boolean,
  executar: () => Promise<Result<object, AppError>>,
) {
  return async (request: Request): Promise<Response> => {
    if (!makeAutenticacaoJob().autorizado(request.headers.get("authorization"))) {
      return new Response("Não autorizado.", { status: 401 });
    }
    if (!ativo()) return Response.json({ ativa: false });
    const resultado = await executar();
    if (!resultado.ok) return new Response(resultado.error.message, { status: 502 });
    const { value } = resultado;
    const falhas = "falhas" in value && typeof value.falhas === "number" ? value.falhas : 0;
    return Response.json(value, { status: falhas > 0 ? 500 : 200 });
  };
}
