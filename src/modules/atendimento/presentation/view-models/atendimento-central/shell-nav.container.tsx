"use client";

import {
  ShellNav,
  type ShellNavProps,
} from "@/presentation/components/organisms/shell-nav.component";
import { useAnuncioDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-anuncio-do-menu.hook";
import { usePendentesDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-pendentes-do-menu.hook";
import { useSomDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-som-da-lista.hook";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

export function ShellNavContainer(props: Pick<ShellNavProps, "setores" | "rotaAtual">) {
  const { total, pronto, idsDaEspera, emAtendimento } = usePendentesDoMenu();
  const foraDaTela = props.rotaAtual !== ROTA_ATENDIMENTO;
  const anuncio = useAnuncioDoMenu(total, pronto, foraDaTela);
  // Na tela Atendimento o som é dela; nas demais telas é do menu.
  useSomDaLista(idsDaEspera, emAtendimento, null, foraDaTela);
  return <ShellNav {...props} pendentesDeAtendimento={total} anuncio={anuncio} />;
}
