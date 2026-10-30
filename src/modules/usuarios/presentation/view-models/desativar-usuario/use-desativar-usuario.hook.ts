import { useState } from "react";

import { useAcaoComPendente } from "../use-acao-com-pendente.hook";
import { desativarUsuarioAction } from "./desativar-usuario.actions";

export function useDesativarUsuario(usuarioId: string) {
  const [confirmando, setConfirmando] = useState(false);
  const { pendente, erro, executar } = useAcaoComPendente(
    "Não foi possível desativar agora. Tente novamente.",
  );

  const aoConfirmar = () => {
    setConfirmando(false);
    return executar(() => desativarUsuarioAction({ usuarioId }));
  };

  return {
    confirmando,
    pendente,
    erro,
    aoPedirConfirmacao: () => setConfirmando(true),
    aoCancelar: () => setConfirmando(false),
    aoConfirmar,
  };
}
