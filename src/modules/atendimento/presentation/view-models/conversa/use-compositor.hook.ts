import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { formatarTamanho } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useEnviarAnexoMutation,
  useEnviarAudioMutation,
  useEnviarMensagemMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useAnexoPendente } from "@/modules/atendimento/presentation/view-models/conversa/use-anexo-pendente.hook";
import { useArrastarArquivo } from "@/modules/atendimento/presentation/view-models/conversa/use-arrastar-arquivo.hook";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";
import { ANEXO_MIMES_ACEITOS } from "@/shared/kernel/anexo";

const ACEITAR = ANEXO_MIMES_ACEITOS.join(",");

export function useCompositor(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const mensagem = useEnviarMensagemMutation(atendimentoId);
  const anexoMutation = useEnviarAnexoMutation(atendimentoId);
  const audioMutation = useEnviarAudioMutation(atendimentoId);
  const pendente = useAnexoPendente(atendimentoId, { limparAoDesmontar: true });
  const [enviadas, setEnviadas] = useState(0);

  const { arquivo } = pendente;
  const concluido = () => {
    pendente.limpar();
    setEnviadas((n) => n + 1);
  };
  const audioEmEnvioOuComFalha = audioMutation.isPending || audioMutation.isError;
  const anexoEmEnvioOuComFalha = arquivo || anexoMutation.isPending || anexoMutation.isError;
  const envio = audioEmEnvioOuComFalha
    ? audioMutation
    : anexoEmEnvioOuComFalha
      ? anexoMutation
      : mensagem;

  const visivel = !conversa.encerrado && !conversa.somenteLeitura && !transferido;
  const aoAnexar = (novo: File) => {
    if (envio.isPending) return;
    anexoMutation.reset();
    pendente.anexar(novo);
  };
  const arraste = useArrastarArquivo(visivel && !envio.isPending ? aoAnexar : undefined);

  return {
    visivel,
    somenteLeitura: conversa.somenteLeitura && !transferido,
    arraste,
    aoEnviar: (texto: string) => {
      if (envio.isPending) return;
      return arquivo
        ? anexoMutation.mutate(
            { arquivo, legenda: texto, miniatura: pendente.miniatura },
            { onSuccess: concluido },
          )
        : mensagem.mutate(texto, { onSuccess: concluido });
    },
    aoEnviarAudio: (audio: File, aoConcluir: () => void) => {
      if (envio.isPending) return;
      audioMutation.mutate({ arquivo: audio }, { onSuccess: aoConcluir });
    },
    aoCancelarAudio: () => audioMutation.reset(),
    enviando: envio.isPending,
    erro: pendente.erro ?? (envio.isError ? envio.error.message : undefined),
    enviadas,
    aceitar: ACEITAR,
    anexo: arquivo
      ? {
          nome: arquivo.name,
          tamanho: formatarTamanho(arquivo.size),
          miniaturaUrl: pendente.miniaturaUrl,
        }
      : undefined,
    aoAnexar,
    aoRemoverAnexo: () => {
      anexoMutation.reset();
      pendente.limpar();
    },
  };
}
