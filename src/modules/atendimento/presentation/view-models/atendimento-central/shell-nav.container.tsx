"use client";

import {
  ShellNav,
  type ShellNavProps,
} from "@/presentation/components/organisms/shell-nav.component";
import { useAnuncioDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-anuncio-do-menu.hook";
import { usePendentesDoMenu } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-pendentes-do-menu.hook";
import { useSomDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-som-da-lista.hook";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

const SEM_CONVERSA_ABERTA = null; // o menu não abre conversa: nenhuma fica de fora do aviso

export function ShellNavContainer(props: Pick<ShellNavProps, "setores" | "rotaAtual">) {
  const { total, pronto, idsDaEspera, emAtendimento } = usePendentesDoMenu();
  const emOutraTela = props.rotaAtual !== ROTA_ATENDIMENTO;
  const anuncio = useAnuncioDoMenu(total, pronto, emOutraTela);
  // O som é da tela Atendimento quando se está nela; nas outras telas é do menu.
  useSomDaLista(idsDaEspera, emAtendimento, SEM_CONVERSA_ABERTA, emOutraTela);
  return <ShellNav {...props} pendentesDeAtendimento={total} anuncio={anuncio} />;
}
