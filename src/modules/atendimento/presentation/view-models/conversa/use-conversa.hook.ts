import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  conversaParaView,
  documentoDaOpcao,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useConversaQuery,
  useEnviarDocumentoMutation,
  useTransferirAtendimentoMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

export function useConversa(atendimentoId: string, initialData: ConversaVista) {
  const transferencia = useTransferirAtendimentoMutation(atendimentoId);
  // Depois de transferida a conversa não é mais do usuário: para de atualizar.
  const query = useConversaQuery(atendimentoId, initialData, !transferencia.isSuccess);
  const envio = useEnviarDocumentoMutation(atendimentoId);

  const conversa = conversaParaView(query.data);
  const transferidoPara = transferencia.isSuccess
    ? conversa.setoresDestino.find((s) => s.valor === transferencia.variables.setorDestino)?.rotulo
    : undefined;

  const aviso = envio.isError
    ? { tipo: "erro" as const, texto: envio.error.message }
    : query.isError && !transferencia.isSuccess
      ? { tipo: "erro" as const, texto: "Não foi possível atualizar a conversa." }
      : envio.isSuccess
        ? { tipo: "sucesso" as const, texto: "Documento enviado ao cliente." }
        : undefined;

  return {
    ...conversa,
    aoEnviarServico: (valor: string) => envio.mutate(documentoDaOpcao(valor)),
    enviando: envio.isPending,
    aviso,
    aoTransferir: (setorDestino: string, resumo: string) =>
      transferencia.mutate({ setorDestino, resumo }),
    transferindo: transferencia.isPending,
    transferidoPara,
    avisoTransferencia: transferencia.isError
      ? { tipo: "erro" as const, texto: transferencia.error.message }
      : undefined,
  };
}
