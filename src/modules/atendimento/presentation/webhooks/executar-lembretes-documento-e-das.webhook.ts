import {
  lembretesAutomaticosAtivos,
  makeAutenticacaoJob,
  makeExecutarLembretesDocumentoEDas,
} from "@/main/atendimento.factory";

// Chamada diária do agendador: o próprio job decide se hoje é dia 01/05/10/15 (São Paulo). O
// Vercel Cron chama com GET; POST serve a outros agendadores.
export async function POST(request: Request): Promise<Response> {
  if (!makeAutenticacaoJob().autorizado(request.headers.get("authorization"))) {
    return new Response("Não autorizado.", { status: 401 });
  }
  // Autenticado, mas desligado: nada é lido, enviado nem alterado.
  if (!lembretesAutomaticosAtivos()) return Response.json({ ativa: false });
  const resultado = await makeExecutarLembretesDocumentoEDas().execute();
  if (!resultado.ok) return new Response(resultado.error.message, { status: 502 });
  // Envio que falhou já virou alerta ao setor, mas a rodada falha aparece nos logs do cron.
  return Response.json(resultado.value, { status: resultado.value.falhas > 0 ? 500 : 200 });
}

export const GET = POST;
