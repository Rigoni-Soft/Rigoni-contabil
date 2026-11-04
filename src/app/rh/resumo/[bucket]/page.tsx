import { notFound, redirect } from "next/navigation";

import { ResumoSetorLista } from "@/presentation/components/organisms/resumo-setor-lista.component";
import { ResumoSetorListaPage } from "@/presentation/components/pages/resumo-setor-lista.page";
import { ERRO_CARREGAR_RESUMO_SETOR } from "@/presentation/lib/erro-resumo-setor";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarResumoSetorRh } from "@/modules/clientes/presentation/view-models/resumo-setor-rh/resumo-setor-rh.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";
import { ROTA_RH, SETOR_RH } from "@/shared/kernel/setores";

type Props = { params: Promise<{ bucket: string }> };

// ponytail: esqueleto repetido em app/clientes/resumo/[bucket]; extrair um helper por Setor quando houver o 3º
// Setor com resumo (Contábil).
export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await exigirSessao();

  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, SETOR_RH)) redirect("/");

  const resumo = await carregarResumoSetorRh();
  const header = <CabecalhoDoShellContainer sessao={sessao} />;
  if (!resumo.ok) {
    return (
      <ResumoSetorListaPage
        header={header}
        titulo="Resumo do setor"
        voltarHref={ROTA_RH}
        erro={ERRO_CARREGAR_RESUMO_SETOR}
        tentarNovamenteHref={`${ROTA_RH}/resumo/${encodeURIComponent(bucket)}`}
      />
    );
  }

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorListaPage
      header={header}
      titulo={card.titulo}
      voltarHref={ROTA_RH}
      lista={
        <ResumoSetorLista
          clientes={card.clientes}
          bucket={bucket}
          vazio={card.mensagemVazia}
          rotaBase={`${ROTA_RH}/resumo`}
        />
      }
    />
  );
}
