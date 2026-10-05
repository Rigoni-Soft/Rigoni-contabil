import { z } from "zod";

import { makeReceberMensagem } from "@/main/atendimento.factory";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";

// Contrato neutro (docs/contratos/mensageria.md); um tradutor de provedor (#68)
// chega nesse formato antes de chamar aqui.
const corpoSchema = z.object({ telefone: z.string().min(1), texto: z.string() });

function status(erro: unknown): number {
  if (erro instanceof ValidationError) return 400;
  if (erro instanceof ServicoExternoError) return 502; // transitório: o remetente tenta de novo
  return 500;
}

export async function POST(request: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = JSON.parse(await request.text());
  } catch {
    return Response.json({ erro: "Corpo não é JSON." }, { status: 400 });
  }
  const dados = corpoSchema.safeParse(corpo);
  if (!dados.success) return Response.json({ erro: "Corpo fora do contrato." }, { status: 400 });

  const resultado = await makeReceberMensagem().execute(dados.data);
  if (!resultado.ok) {
    return Response.json({ erro: resultado.error.message }, { status: status(resultado.error) });
  }
  return Response.json({ ok: true });
}
