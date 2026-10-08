import { jobAutorizado, makeVerificarInatividade } from "@/main/atendimento.factory";

// Chamada periódica do agendador (a cada poucos minutos): a URA verifica a inatividade.
export async function POST(request: Request): Promise<Response> {
  if (!jobAutorizado(request.headers.get("authorization"))) {
    return new Response("Não autorizado.", { status: 401 });
  }
  const resultado = await makeVerificarInatividade().execute();
  if (!resultado.ok) return new Response(resultado.error.message, { status: 502 });
  return Response.json(resultado.value);
}
