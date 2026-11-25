import type { ActionResult } from "@/shared/dtos/action-result.dto";

type ResultadoDaAba =
  { tipo: "aberta" } | { tipo: "bloqueada"; url: string } | { tipo: "erro"; mensagem: string };

export async function abrirEmNovaAba(
  obterUrl: () => Promise<ActionResult<{ url: string }>>,
): Promise<ResultadoDaAba> {
  const aba = window.open("about:blank", "_blank");
  if (aba) aba.opener = null;
  try {
    const resultado = await obterUrl();
    if (resultado.ok && aba) {
      aba.location.href = resultado.data.url;
      return { tipo: "aberta" };
    }
    aba?.close();
    return resultado.ok
      ? { tipo: "bloqueada", url: resultado.data.url }
      : { tipo: "erro", mensagem: resultado.error.message };
  } catch (erro) {
    aba?.close();
    throw erro;
  }
}
