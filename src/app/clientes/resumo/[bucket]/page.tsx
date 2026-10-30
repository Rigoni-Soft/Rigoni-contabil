import { notFound, redirect } from "next/navigation";

import { ResumoSetorSnLista } from "@/presentation/components/organisms/resumo-setor-sn-lista.component";
import { ResumoSetorSnListaPage } from "@/presentation/components/pages/resumo-setor-sn-lista.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarResumoSetorSn } from "@/modules/clientes/presentation/view-models/resumo-setor-sn/resumo-setor-sn.server";
import { podeVerDashboardSn } from "@/shared/kernel/papeis";

type Props = { params: Promise<{ bucket: string }> };

export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await exigirSessao();

  // Resumo do setor é exclusivo do Simples Nacional — mesmo critério de acesso de app/page.tsx.
  if (!podeVerDashboardSn(sessao.papel, sessao.setor)) redirect("/");

  const resumo = await carregarResumoSetorSn();
  if (!resumo.ok) redirect("/");

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorSnListaPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={card.titulo}
      descricao={card.descricao}
      lista={
        <ResumoSetorSnLista clientes={card.clientes} bucket={bucket} vazio={card.mensagemVazia} />
      }
    />
  );
}
