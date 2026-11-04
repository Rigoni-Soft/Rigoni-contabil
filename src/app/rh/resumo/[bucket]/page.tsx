import { notFound, redirect } from "next/navigation";

import { ResumoSetorSnLista } from "@/presentation/components/organisms/resumo-setor-sn-lista.component";
import { ResumoSetorSnListaPage } from "@/presentation/components/pages/resumo-setor-sn-lista.page";
import { ERRO_CARREGAR_RESUMO_SETOR } from "@/presentation/lib/erro-resumo-setor";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarResumoSetorRh } from "@/modules/clientes/presentation/view-models/resumo-setor-rh/resumo-setor-rh.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";
import { SETOR_RH } from "@/shared/kernel/setores";

type Props = { params: Promise<{ bucket: string }> };

export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await exigirSessao();

  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, SETOR_RH)) redirect("/");

  const resumo = await carregarResumoSetorRh();
  const header = <CabecalhoDoShellContainer sessao={sessao} />;
  if (!resumo.ok) {
    return (
      <ResumoSetorSnListaPage
        header={header}
        titulo="Resumo do setor"
        voltarHref="/rh"
        erro={ERRO_CARREGAR_RESUMO_SETOR}
        tentarNovamenteHref={`/rh/resumo/${encodeURIComponent(bucket)}`}
      />
    );
  }

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorSnListaPage
      header={header}
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
