import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { gerarMiniatura } from "@/presentation/lib/miniatura-de-imagem";
import { conversaKeys } from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { ANEXO_MINIATURA_LADO, validarAnexo } from "@/shared/kernel/anexo";

// `miniatura`: versão reduzida da imagem, gerada em segundo plano; vai junto no envio.
type AnexoPendenteEstado = {
  arquivo: File | null;
  miniaturaUrl: string | null;
  miniatura: File | null;
  erro?: string;
};
const ANEXO_PENDENTE_VAZIO: AnexoPendenteEstado = {
  arquivo: null,
  miniaturaUrl: null,
  miniatura: null,
};

function revogar(estado: AnexoPendenteEstado | undefined) {
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
    queryFn: () => ANEXO_PENDENTE_VAZIO,
    initialData: ANEXO_PENDENTE_VAZIO,
    staleTime: Infinity,
    enabled: false,
  });

  useEffect(() => {
    if (!limparAoDesmontar) return;
    // A chave é recriada a cada render: a dependência é o id, para o efeito só rodar ao sair.
    const chaveDoAtendimento = conversaKeys.anexoPendente(atendimentoId);
    return () => {
      revogar(queryClient.getQueryData<AnexoPendenteEstado>(chaveDoAtendimento));
      queryClient.setQueryData<AnexoPendenteEstado>(chaveDoAtendimento, ANEXO_PENDENTE_VAZIO);
    };
  }, [limparAoDesmontar, queryClient, atendimentoId]);

  function trocar(novo: AnexoPendenteEstado) {
    revogar(queryClient.getQueryData<AnexoPendenteEstado>(chave));
    queryClient.setQueryData<AnexoPendenteEstado>(chave, novo);
  }

  return {
    arquivo: estado.arquivo,
    miniaturaUrl: estado.miniaturaUrl,
    miniatura: estado.miniatura,
    erro: estado.erro,
    anexar(arquivo: File) {
      const { tipo, erro } = validarAnexo(arquivo.type, arquivo.size);
      if (!tipo) return trocar({ ...ANEXO_PENDENTE_VAZIO, erro });
      trocar({
        ...ANEXO_PENDENTE_VAZIO,
        arquivo,
        miniaturaUrl: tipo === "imagem" ? URL.createObjectURL(arquivo) : null,
      });
      if (tipo !== "imagem") return;
      void gerarMiniatura(arquivo, ANEXO_MINIATURA_LADO).then((miniatura) => {
        const atual = queryClient.getQueryData<AnexoPendenteEstado>(chave);
        // O arquivo pode ter sido trocado ou removido enquanto a miniatura saía.
        if (miniatura && atual?.arquivo === arquivo) {
          queryClient.setQueryData<AnexoPendenteEstado>(chave, { ...atual, miniatura });
        }
      });
    },
    limpar: () => trocar(ANEXO_PENDENTE_VAZIO),
  };
}
