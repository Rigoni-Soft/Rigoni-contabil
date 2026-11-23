import { useCallback } from "react";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

export type ResultadoDeDeixarDeUsar = { ok: true } | { ok: false; mensagem: string };

// Tira os envios do Setor no contato de outro dono: ele sai da lista do Setor e segue com o dono e os outros
// Setores. A falha volta dita, sem lançar.
export function useDeixarDeUsarContato(clienteId: string) {
  return useCallback(
    async (contatoId: string): Promise<ResultadoDeDeixarDeUsar> => {
      try {
        const resultado = await definirTiposDoContatoAction({ clienteId, contatoId, tipos: [] });
        if (resultado.ok) return { ok: true };
        return { ok: false, mensagem: resultado.error.message };
      } catch (erro) {
        console.error("Falha ao deixar de usar o contato", erro);
        return { ok: false, mensagem: mensagemDaFalha(erro) };
      }
    },
    [clienteId],
  );
}
