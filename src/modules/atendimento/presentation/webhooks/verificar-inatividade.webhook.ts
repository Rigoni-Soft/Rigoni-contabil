import {
  inatividadeAutomaticaAtiva,
  makeAutenticacaoJob,
  makeVerificarInatividade,
} from "@/main/atendimento.factory";

// Chamada periódica do agendador (a cada poucos minutos): a URA verifica a inatividade. O Vercel
// Cron chama com GET; POST serve a outros agendadores.
export async function POST(request: Request): Promise<Response> {
  if (!makeAutenticacaoJob().autorizado(request.headers.get("authorization"))) {
    return new Response("Não autorizado.", { status: 401 });
  }
  // Autenticado, mas desligado: nada é lido nem alterado.
  if (!inatividadeAutomaticaAtiva()) return Response.json({ ativa: false });
  const resultado = await makeVerificarInatividade().execute();
  if (!resultado.ok) return new Response(resultado.error.message, { status: 502 });
  return Response.json(resultado.value);
}

export const GET = POST;
