"use client";

import { AvatarDaConta } from "@/presentation/components/organisms/avatar-da-conta.component";
import { srcDoAvatar } from "@/shared/kernel/avatar";
import { escopoDoUsuario } from "@/shared/kernel/escopo-do-usuario";

import { ACEITAR_FOTO } from "./avatar.presenter";
import { ID_DO_ESCOLHER_FOTO, useAvatarDaConta } from "./use-avatar-da-conta.hook";

export function AvatarDaContaContainer({
  papel,
  setor,
  avatarAtualizadoEm,
}: {
  papel: string;
  setor: string;
  avatarAtualizadoEm: string | null;
}) {
  const { logo } = escopoDoUsuario({ papel, setor });

  return (
    <AvatarDaConta
      srcAtual={srcDoAvatar({ avatarAtualizadoEm, logo })}
      temFoto={avatarAtualizadoEm !== null}
      idDoEscolher={ID_DO_ESCOLHER_FOTO}
      aceitar={ACEITAR_FOTO}
      {...useAvatarDaConta()}
    />
  );
}
