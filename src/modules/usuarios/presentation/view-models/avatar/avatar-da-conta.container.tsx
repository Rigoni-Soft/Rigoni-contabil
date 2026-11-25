"use client";

import { AvatarDaConta } from "@/presentation/components/organisms/avatar-da-conta.component";

import { ACEITAR_FOTO, imagemDoAvatar } from "./avatar.presenter";
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
  return (
    <AvatarDaConta
      {...imagemDoAvatar({ papel, setor, avatarAtualizadoEm })}
      idDoEscolher={ID_DO_ESCOLHER_FOTO}
      aceitar={ACEITAR_FOTO}
      {...useAvatarDaConta()}
    />
  );
}
