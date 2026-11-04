import { notFound, redirect } from "next/navigation";

import { ResumoSetorLista } from "@/presentation/components/organisms/resumo-setor-lista.component";
import { ResumoSetorListaPage } from "@/presentation/components/pages/resumo-setor-lista.page";
import { ERRO_CARREGAR_RESUMO_SETOR } from "@/presentation/lib/erro-resumo-setor";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarResumoSetorSn } from "@/modules/clientes/presentation/view-models/resumo-setor-sn/resumo-setor-sn.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";
import { ROTA_SN, SETOR_SN } from "@/shared/kernel/setores";

type Props = { params: Promise<{ bucket: string }> };

export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await exigirSessao();

  // Resumo do setor é exclusivo do Simples Nacional — mesmo critério de acesso de app/page.tsx.
  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, SETOR_SN)) redirect("/");

  const resumo = await carregarResumoSetorSn();
  const header = <CabecalhoDoShellContainer sessao={sessao} />;
  if (!resumo.ok) {
    return (
      <ResumoSetorListaPage
        header={header}
        titulo="Resumo do setor"
        voltarHref={ROTA_SN}
        erro={ERRO_CARREGAR_RESUMO_SETOR}
        tentarNovamenteHref={`/clientes/resumo/${encodeURIComponent(bucket)}`}
      />
    );
  }

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorListaPage
      header={header}
      titulo={card.titulo}
      voltarHref={ROTA_SN}
      descricao={card.descricao}
      lista={
        <ResumoSetorLista
          clientes={card.clientes}
          bucket={bucket}
          vazio={card.mensagemVazia}
          rotaBase="/clientes/resumo"
        />
      }
    />
  );
}
