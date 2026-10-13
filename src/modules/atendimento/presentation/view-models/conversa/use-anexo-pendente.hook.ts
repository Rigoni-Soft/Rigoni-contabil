import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { conversaKeys } from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { ANEXO_TAMANHO_MAXIMO, ANEXO_TIPO_RECUSADO, classificarAnexo } from "@/shared/kernel/anexo";

type Estado = { arquivo: File | null; miniaturaUrl: string | null; erro?: string };
const VAZIO: Estado = { arquivo: null, miniaturaUrl: null };

function revogar(estado: Estado | undefined) {
  if (estado?.miniaturaUrl) URL.revokeObjectURL(estado.miniaturaUrl);
}

// O arquivo escolhido e ainda não enviado. Vive no cache do React Query porque o campo de resposta
// (que o envia) e a conversa (onde também se solta um arquivo) são regiões diferentes da tela.
// O servidor confere tipo e tamanho de novo; aqui só se antecipa a mensagem.
// `limparAoDesmontar`: quem envia o arquivo (o campo de resposta) solta a prévia e libera o blob ao
// sair da tela; as outras regiões só leem ou depositam.
export function useAnexoPendente(atendimentoId: string, { limparAoDesmontar = false } = {}) {
  const queryClient = useQueryClient();
  const chave = conversaKeys.anexoPendente(atendimentoId);
  const { data: estado } = useQuery({
    queryKey: chave,
    queryFn: () => VAZIO,
    initialData: VAZIO,
    staleTime: Infinity,
    enabled: false,
  });

  useEffect(() => {
    if (!limparAoDesmontar) return;
    // A chave é recriada a cada render: a dependência é o id, para o efeito só rodar ao sair.
    const chaveDoAtendimento = conversaKeys.anexoPendente(atendimentoId);
    return () => {
      revogar(queryClient.getQueryData<Estado>(chaveDoAtendimento));
      queryClient.setQueryData<Estado>(chaveDoAtendimento, VAZIO);
    };
  }, [limparAoDesmontar, queryClient, atendimentoId]);

  function trocar(novo: Estado) {
    revogar(queryClient.getQueryData<Estado>(chave));
    queryClient.setQueryData<Estado>(chave, novo);
  }

  return {
    arquivo: estado.arquivo,
    miniaturaUrl: estado.miniaturaUrl,
    erro: estado.erro,
    anexar(arquivo: File) {
      const tipo = classificarAnexo(arquivo.type);
      if (!tipo) {
        return trocar({
          ...VAZIO,
          erro: ANEXO_TIPO_RECUSADO,
        });
      }
      if (arquivo.size > ANEXO_TAMANHO_MAXIMO) {
        return trocar({ ...VAZIO, erro: "O arquivo aceita até 10 MB." });
      }
      trocar({
        arquivo,
        miniaturaUrl: tipo === "imagem" ? URL.createObjectURL(arquivo) : null,
      });
    },
    limpar: () => trocar(VAZIO),
  };
}
