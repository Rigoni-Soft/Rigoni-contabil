import { useCallback } from "react";

import type { ValoresDaLinha } from "./contato-da-linha.presenter";
import { salvarContatoAction } from "./salvar-contato.actions";
import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

type Entrada = {
  contato: ValoresDaLinha;
  gravarCampos: boolean;
  gravarEnvios: boolean;
  tipos: string[];
  canal?: string;
};

type Gravacao = {
  id?: string;
  camposGravados: boolean;
  falha?: string;
};

export function useGravarContatoDaLinha(clienteId: string) {
  return useCallback(
    async ({ contato, gravarCampos, gravarEnvios, tipos, canal }: Entrada): Promise<Gravacao> => {
      let id = contato.id;
      if (gravarCampos) {
        const resultado = await salvarContatoAction({
          clienteId,
          contato: { id, nome: contato.nome, telefone: contato.telefone, email: contato.email },
        });
        if (!resultado.ok) return { id, camposGravados: false, falha: resultado.error.message };
        id = resultado.data.id;
      }
      if (!gravarEnvios || !id) return { id, camposGravados: gravarCampos };
      const envios = await definirTiposDoContatoAction({ clienteId, contatoId: id, tipos, canal });
      if (envios.ok) return { id, camposGravados: gravarCampos };
      const { message } = envios.error;
      const falha = gravarCampos ? `Contato salvo, mas os envios não: ${message}` : message;
      return { id, camposGravados: gravarCampos, falha };
    },
    [clienteId],
  );
}
