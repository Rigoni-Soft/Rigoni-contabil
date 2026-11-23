import { useCallback } from "react";

import type { ValoresDaLinha } from "./contato-da-linha.presenter";
import { salvarContatoAction } from "./salvar-contato.actions";
import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";

type Entrada = {
  contato: ValoresDaLinha;
  // Nome, WhatsApp e e-mail mudaram e quem edita é dono: grava o contato.
  gravarCampos: boolean;
  // O que o contato recebe mudou e quem edita tem Setor: grava os envios.
  gravarEnvios: boolean;
  tipos: string[];
  // Só quando o contato tem os dois canais e há envio marcado (o banco exige a escolha).
  canal?: string;
};

export type Gravacao = {
  id?: string;
  // O contato (os campos) já está gravado, mesmo que os envios tenham falhado.
  camposGravados: boolean;
  falha?: string;
};

// Grava a linha em duas chamadas: o contato e, em seguida, o que ele recebe do Setor. A falha dos envios depois de
// o contato gravado volta dita assim, porque o contato já ficou.
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
      const mensagem = envios.error.message;
      return {
        id,
        camposGravados: gravarCampos,
        falha: gravarCampos ? `Contato salvo, mas os envios não: ${mensagem}` : mensagem,
      };
    },
    [clienteId],
  );
}
