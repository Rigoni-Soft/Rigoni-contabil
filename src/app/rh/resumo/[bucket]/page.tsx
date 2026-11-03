import { notFound, redirect } from "next/navigation";

import { ResumoSetorSnLista } from "@/presentation/components/organisms/resumo-setor-sn-lista.component";
import { ResumoSetorSnListaPage } from "@/presentation/components/pages/resumo-setor-sn-lista.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarResumoSetorRh } from "@/modules/clientes/presentation/view-models/resumo-setor-rh/resumo-setor-rh.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";

type Props = { params: Promise<{ bucket: string }> };

export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await exigirSessao();

  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, "rh")) redirect("/");

  const resumo = await carregarResumoSetorRh();
  if (!resumo.ok) redirect("/");

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorSnListaPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={card.titulo}
      voltarHref="/rh"
      lista={
        <ResumoSetorSnLista
          clientes={card.clientes}
          bucket={bucket}
          vazio={card.mensagemVazia}
          rotaBase="/rh/resumo"
        />
      }
    />
  );
}
