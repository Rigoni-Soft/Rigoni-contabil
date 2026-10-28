"use client";

import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { usePendentesDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-pendentes-do-menu.hook";

type ShellNavContainerProps = Pick<Parameters<typeof ShellNav>[0], "setores" | "rotaAtual">;

export function ShellNavContainer(props: ShellNavContainerProps) {
  return <ShellNav {...props} pendentesDeAtendimento={usePendentesDoMenu()} />;
}
