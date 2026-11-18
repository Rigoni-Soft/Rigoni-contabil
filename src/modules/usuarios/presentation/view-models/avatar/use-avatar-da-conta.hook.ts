import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { recortarQuadrado } from "@/presentation/lib/recortar-quadrado";
import type { ActionResult } from "@/shared/dtos/action-result.dto";

import { enviarAvatarAction, removerAvatarAction } from "./avatar.actions";
import { avisoDaFoto, LADO_DO_AVATAR, type AcaoDoAvatar } from "./avatar.presenter";

export const ID_DO_ESCOLHER_FOTO = "avatar-escolher-foto";

type Previa = { blob: Blob; url: string };

export function useAvatarDaConta() {
  const router = useRouter();
  const [previa, setPrevia] = useState<Previa | undefined>();
  const [acao, setAcao] = useState<AcaoDoAvatar | undefined>();
  const [erro, setErro] = useState<string | undefined>();
  const devolverFoco = useRef(false);

  // Salvar, cancelar e remover fazem o botão clicado sumir: o foco vai ao "Escolher foto", que existe
  // nos dois estados, e nunca cai no <body> (DESIGN.md, "Foco do teclado depois da ação").
  useEffect(() => {
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    document.getElementById(ID_DO_ESCOLHER_FOTO)?.focus();
  });

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa.url);
    };
  }, [previa]);

  const aoEscolher = async (arquivo: File) => {
    setErro(undefined);
    const aviso = avisoDaFoto(arquivo);
    if (aviso) {
      setErro(aviso);
      return;
    }
    setAcao("preparando");
    try {
      const blob = await recortarQuadrado(arquivo, LADO_DO_AVATAR);
      setPrevia({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setErro("Não foi possível ler essa imagem. Escolha outra.");
    } finally {
      setAcao(undefined);
    }
  };

  const executar = async (
    emCurso: AcaoDoAvatar,
    fazer: () => Promise<ActionResult<unknown>>,
    falha: string,
  ) => {
    setAcao(emCurso);
    setErro(undefined);
    try {
      const resultado = await fazer();
      if (!resultado.ok) {
        setErro(resultado.error.message);
        return;
      }
      setPrevia(undefined);
      devolverFoco.current = true;
      router.refresh();
    } catch {
      setErro(falha);
    } finally {
      setAcao(undefined);
    }
  };

  const aoSalvar = () => {
    if (!previa) return;
    const formData = new FormData();
    formData.set("foto", previa.blob, "avatar.webp");
    return executar(
      "salvando",
      () => enviarAvatarAction(formData),
      "Não foi possível salvar a foto agora. Tente novamente.",
    );
  };

  const aoRemover = () =>
    executar(
      "removendo",
      () => removerAvatarAction(),
      "Não foi possível remover a foto agora. Tente novamente.",
    );

  const aoCancelar = () => {
    setPrevia(undefined);
    setErro(undefined);
    devolverFoco.current = true;
  };

  return {
    previaSrc: previa?.url,
    acao,
    erro,
    aoEscolher,
    aoSalvar,
    aoCancelar,
    aoRemover,
  };
}
