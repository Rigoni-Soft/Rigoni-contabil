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
  // Muda a cada envio que deu certo: a View usa para esvaziar o campo (falhou, o texto fica).
  const [enviadas, setEnviadas] = useState(0);

  const { arquivo } = pendente;
  const concluido = () => {
    pendente.limpar();
    setEnviadas((n) => n + 1);
  };
  // O áudio gravado não é arquivo pendente: a mutação dele (em curso ou com erro) é quem responde
  // até a gravação ser enviada ou cancelada. Depois, a do arquivo escolhido; senão, a do texto.
  const envio =
    audioMutation.isPending || audioMutation.isError
      ? audioMutation
      : arquivo || anexoMutation.isPending || anexoMutation.isError
        ? anexoMutation
        : mensagem;

  const visivel = !conversa.encerrado && !transferido;
  const aoAnexar = (novo: File) => {
    // Trocar o arquivo no meio do envio faria o sucesso limpar o arquivo novo.
    if (envio.isPending) return;
    // Um erro antigo do envio não fica ao lado do arquivo novo.
    anexoMutation.reset();
    pendente.anexar(novo);
  };
  const arraste = useArrastarArquivo(visivel && !envio.isPending ? aoAnexar : undefined);

  return {
    // Encerrado ou transferido: a conversa não é mais do usuário.
    visivel,
    arraste,
    // Com arquivo escolhido, o texto é a legenda.
    aoEnviar: (texto: string) => {
      // Enter repetido antes de a tela travar o botão não reenvia.
      if (envio.isPending) return;
      return arquivo
        ? anexoMutation.mutate(
            { arquivo, legenda: texto, miniatura: pendente.miniatura },
            { onSuccess: concluido },
          )
        : mensagem.mutate(texto, { onSuccess: concluido });
    },
    // Grava e envia o áudio; `aoConcluir` roda só se a entrega deu certo (falhou, a gravação fica).
    aoEnviarAudio: (audio: File, aoConcluir: () => void) => {
      if (envio.isPending) return;
      audioMutation.mutate({ arquivo: audio }, { onSuccess: aoConcluir });
    },
    // Descartar a gravação que falhou ao enviar também apaga o erro dela.
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
