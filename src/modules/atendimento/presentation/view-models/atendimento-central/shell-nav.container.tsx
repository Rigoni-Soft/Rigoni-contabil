"use client";

import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { useAnuncioDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-anuncio-do-menu.hook";
import { usePendentesDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-pendentes-do-menu.hook";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

type ShellNavContainerProps = Pick<Parameters<typeof ShellNav>[0], "setores" | "rotaAtual">;

export function ShellNavContainer(props: ShellNavContainerProps) {
  const { total, pronto } = usePendentesDoMenu();
  const anuncio = useAnuncioDoMenu(total, pronto, props.rotaAtual !== ROTA_ATENDIMENTO);
  return <ShellNav {...props} pendentesDeAtendimento={total} anuncio={anuncio} />;
}
