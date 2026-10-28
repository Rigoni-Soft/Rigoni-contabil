import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { documentoDaOpcao } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useEncerrarAtendimentoMutation,
  useEnviarDocumentoMutation,
  useTransferirAtendimentoMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";

// `aoSair`: onde a tela vai quando a conversa deixa de ser do usuário; sem ele, volta ao início
// (a conversa em rota própria). O chat central da aba Atendimento passa o seu: fecha o painel.
export function useAcoesConversa(
  atendimentoId: string,
  initialData: ConversaVista,
  aoSair?: () => void,
) {
  const { conversa, transferidoPara, transferido, erroDeLeitura } = useConversa(
    atendimentoId,
    initialData,
  );
  const router = useRouter();
  const envio = useEnviarDocumentoMutation(atendimentoId);
  const transferencia = useTransferirAtendimentoMutation(atendimentoId);
  const encerramento = useEncerrarAtendimentoMutation(atendimentoId);
  const [confirmandoEncerramento, setConfirmandoEncerramento] = useState(false);
  const sairDaConversa = aoSair ?? (() => router.push("/"));

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
    // Transferido, o Funcionário perde o controle e a visão da conversa: a tela volta ao início.
    aoTransferir: (setorDestino: string, resumo: string) =>
      transferencia.mutate({ setorDestino, resumo }, { onSuccess: sairDaConversa }),
    transferindo: transferencia.isPending,
    avisoTransferencia: transferencia.isError
      ? { tipo: "erro" as const, texto: transferencia.error.message }
      : undefined,
    // Encerrar não tem volta: pede confirmação. Encerrado, o Funcionário sai da conversa como na
    // transferência.
    confirmandoEncerramento,
    aoPedirEncerramento: () => setConfirmandoEncerramento(true),
    aoCancelarEncerramento: () => setConfirmandoEncerramento(false),
    aoConfirmarEncerramento: () =>
      encerramento.mutate(undefined, {
        onSuccess: sairDaConversa,
        onSettled: () => setConfirmandoEncerramento(false),
      }),
    encerrando: encerramento.isPending,
    avisoEncerramento: encerramento.isError
      ? { tipo: "erro" as const, texto: encerramento.error.message }
      : undefined,
  };
}
