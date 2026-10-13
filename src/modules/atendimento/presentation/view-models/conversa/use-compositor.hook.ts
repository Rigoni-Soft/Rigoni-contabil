import { useState } from "react";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { formatarTamanho } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useEnviarAnexoMutation,
  useEnviarMensagemMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useAnexoPendente } from "@/modules/atendimento/presentation/view-models/conversa/use-anexo-pendente.hook";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";
import { ANEXO_MIMES_ACEITOS } from "@/shared/kernel/anexo";

const ACEITAR = ANEXO_MIMES_ACEITOS.join(",");

export function useCompositor(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const mensagem = useEnviarMensagemMutation(atendimentoId);
  const anexoMutation = useEnviarAnexoMutation(atendimentoId);
  const pendente = useAnexoPendente(atendimentoId, { limparAoDesmontar: true });
  // Muda a cada envio que deu certo: a View usa para esvaziar o campo (falhou, o texto fica).
  const [enviadas, setEnviadas] = useState(0);

  const { arquivo } = pendente;
  const concluido = () => {
    pendente.limpar();
    setEnviadas((n) => n + 1);
  };
  const envio = arquivo ? anexoMutation : mensagem;

  return {
    // Encerrado ou transferido: a conversa não é mais do usuário.
    visivel: !conversa.encerrado && !transferido,
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
    aoAnexar: (novo: File) => {
      // Trocar o arquivo no meio do envio faria o sucesso limpar o arquivo novo.
      if (envio.isPending) return;
      // Um erro antigo do envio não fica ao lado do arquivo novo.
      anexoMutation.reset();
      pendente.anexar(novo);
    },
    aoRemoverAnexo: () => {
      anexoMutation.reset();
      pendente.limpar();
    },
  };
}
