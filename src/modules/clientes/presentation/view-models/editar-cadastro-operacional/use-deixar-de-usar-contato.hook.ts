import { useCallback } from "react";

import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

type ResultadoDeDeixarDeUsar = { ok: true } | { ok: false; mensagem: string };

export function useDeixarDeUsarContato(clienteId: string) {
  return useCallback(
    async (contatoId: string): Promise<ResultadoDeDeixarDeUsar> => {
      const resultado = await definirTiposDoContatoAction({ clienteId, contatoId, tipos: [] });
      return resultado.ok ? { ok: true } : { ok: false, mensagem: resultado.error.message };
    },
    [clienteId],
  );
}
