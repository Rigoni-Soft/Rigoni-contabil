import type { PapelAlteravel } from "@/modules/usuarios/application/ports/out/alteracao-papel.provider";

import { useAcaoComPendente } from "../use-acao-com-pendente.hook";
import { alterarPapelUsuarioAction } from "./alterar-papel.actions";

// Sem confirmação inline (diferente de desativar): a troca é reversível e auditada.
export function useAlterarPapel(usuarioId: string, papel: PapelAlteravel) {
  const { pendente, erro, executar } = useAcaoComPendente(
    "Não foi possível alterar o papel agora. Tente novamente.",
  );

  return {
    pendente,
    erro,
    aoAlterar: () => executar(() => alterarPapelUsuarioAction({ usuarioId, papel })),
  };
}
