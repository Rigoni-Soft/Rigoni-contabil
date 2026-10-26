import type { ActionResult } from "@/shared/dtos/action-result.dto";

export type ResultadoDaAba =
  | { tipo: "aberta" }
  // O navegador barrou a aba: o link já gerado pode ser oferecido na tela.
  | { tipo: "bloqueada"; url: string }
  | { tipo: "erro"; mensagem: string };

// Abre um link temporário (gerado pelo servidor depois de checar a permissão) numa aba nova. A aba abre
// de forma síncrona no clique (senão o bloqueador de pop-up barra) e recebe o link quando a Server
// Action devolve; `opener` zerado no lugar de `noopener`, para guardar a referência. Se a action
// rejeitar, a aba é fechada e o erro segue para quem chamou.
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
