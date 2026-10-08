import { useState } from "react";
import { useRouter } from "next/navigation";

import { desativarUsuarioAction } from "./desativar-usuario.actions";

export function useDesativarUsuario(usuarioId: string) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const aoConfirmar = async () => {
    setConfirmando(false);
    setPendente(true);
    setErro(undefined);
    try {
      const resultado = await desativarUsuarioAction({ usuarioId });
      if (!resultado.ok) setErro(resultado.error.message);
      else router.refresh();
    } catch {
      setErro("Não foi possível desativar agora. Tente novamente.");
    } finally {
      setPendente(false);
    }
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
