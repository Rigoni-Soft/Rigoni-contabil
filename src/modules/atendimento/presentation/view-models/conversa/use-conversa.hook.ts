import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  conversaParaView,
  documentoDaOpcao,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useConversaQuery,
  useEnviarDocumentoMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

export function useConversa(atendimentoId: string, initialData: ConversaVista) {
  const query = useConversaQuery(atendimentoId, initialData);
  const envio = useEnviarDocumentoMutation(atendimentoId);

  const conversa = conversaParaView(query.data);

  const aviso = envio.isError
    ? { tipo: "erro" as const, texto: envio.error.message }
    : query.isError
      ? { tipo: "erro" as const, texto: "Não foi possível atualizar a conversa." }
      : envio.isSuccess
        ? { tipo: "sucesso" as const, texto: "Documento enviado ao cliente." }
        : undefined;

  return {
    ...conversa,
    aoEnviarServico: (valor: string) => envio.mutate(documentoDaOpcao(valor)),
    enviando: envio.isPending,
    aviso,
  };
}
