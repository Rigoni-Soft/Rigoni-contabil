"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  UsuariosLista,
  type UsuarioListado,
} from "@/presentation/components/organisms/usuarios-lista.component";

import { desativarUsuarioAction } from "../desativar-usuario/desativar-usuario.actions";

export function ListarUsuariosContainer({ usuarios }: { usuarios: UsuarioListado[] }) {
  const router = useRouter();
  const [confirmandoId, setConfirmandoId] = useState<string | undefined>();
  const [pendenteId, setPendenteId] = useState<string | undefined>();
  const [erro, setErro] = useState<string | undefined>();

  const aoConfirmar = async (usuarioId: string) => {
    setConfirmandoId(undefined);
    setPendenteId(usuarioId);
    setErro(undefined);
    try {
      const resultado = await desativarUsuarioAction({ usuarioId });
      if (!resultado.ok) setErro(resultado.error.message);
      else router.refresh();
    } catch {
      setErro("Não foi possível desativar agora. Tente novamente.");
    } finally {
      setPendenteId(undefined);
    }
  };

  return (
    <UsuariosLista
      usuarios={usuarios}
      confirmandoId={confirmandoId}
      pendenteId={pendenteId}
      erro={erro}
      aoPedirConfirmacao={setConfirmandoId}
      aoCancelar={() => setConfirmandoId(undefined)}
      aoConfirmar={aoConfirmar}
    />
  );
}
