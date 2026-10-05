import { useState } from "react";
import { useRouter } from "next/navigation";

import { alterarPapelUsuarioAction } from "./alterar-papel.actions";

// Sem confirmação inline (diferente de desativar): a troca é reversível e auditada.
export function useAlterarPapel(usuarioId: string, papelAtual: string) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const aoAlterar = async () => {
    setPendente(true);
    setErro(undefined);
    try {
      const papel = papelAtual === "lider_setor" ? "funcionario" : "lider_setor";
      const resultado = await alterarPapelUsuarioAction({ usuarioId, papel });
      if (!resultado.ok) setErro(resultado.error.message);
      else router.refresh();
    } catch {
      setErro("Não foi possível alterar o papel agora. Tente novamente.");
    } finally {
      setPendente(false);
    }
  };

  return { pendente, erro, aoAlterar };
}
