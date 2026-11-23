import { useCallback } from "react";

import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

type ResultadoDeDeixarDeUsar = { ok: true } | { ok: false; mensagem: string };

// Tira os envios do Setor no contato de outro dono: ele sai da lista do Setor e segue com o dono e os outros
// Setores. A falha do servidor volta dita; a que lança fica com quem chama (como em useGravarContatoDaLinha).
export function useDeixarDeUsarContato(clienteId: string) {
  return useCallback(
    async (contatoId: string): Promise<ResultadoDeDeixarDeUsar> => {
      const resultado = await definirTiposDoContatoAction({ clienteId, contatoId, tipos: [] });
      return resultado.ok ? { ok: true } : { ok: false, mensagem: resultado.error.message };
    },
    [clienteId],
  );
}
