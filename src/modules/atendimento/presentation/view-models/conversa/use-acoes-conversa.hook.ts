import { useRouter } from "next/navigation";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { documentoDaOpcao } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useEnviarDocumentoMutation,
  useTransferirAtendimentoMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

export function useAcoesConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferidoPara, transferido, erroDeLeitura } = useConversa(
    atendimentoId,
    initialData,
  );
  const router = useRouter();
  const envio = useEnviarDocumentoMutation(atendimentoId);
  const transferencia = useTransferirAtendimentoMutation(atendimentoId);

  const aviso = envio.isError
    ? { tipo: "erro" as const, texto: envio.error.message }
    : erroDeLeitura
      ? { tipo: "erro" as const, texto: "Não foi possível atualizar a conversa." }
      : envio.isSuccess
        ? { tipo: "sucesso" as const, texto: "Documento enviado ao cliente." }
        : undefined;

  return {
    // Encerrado não tem ações; transferido mostra só o aviso de para onde foi.
    visivel: !conversa.encerrado || transferido,
    transferidoPara,
    semCliente: conversa.semCliente,
    servicos: conversa.servicos,
    aoEnviarServico: (valor: string) => envio.mutate(documentoDaOpcao(valor)),
    enviando: envio.isPending,
    aviso,
    setoresDestino: conversa.setoresDestino,
    // Transferido, o Funcionário perde o controle e a visão da conversa: a tela sai dela e abre o
    // Atendimento da Fila que ele assumiu ao ficar livre; sem ele, volta ao início.
    aoTransferir: (setorDestino: string, resumo: string) =>
      transferencia.mutate(
        { setorDestino, resumo },
        {
          onSuccess: (proximoDaFila) =>
            router.push(proximoDaFila ? `/atendimento/${proximoDaFila}` : "/"),
        },
      ),
    transferindo: transferencia.isPending,
    avisoTransferencia: transferencia.isError
      ? { tipo: "erro" as const, texto: transferencia.error.message }
      : undefined,
  };
}
