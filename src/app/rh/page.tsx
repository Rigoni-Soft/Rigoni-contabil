import { redirect } from "next/navigation";

import { ComparativosRh } from "@/presentation/components/organisms/comparativos-rh.component";
import { ResumoDoSetor } from "@/presentation/components/organisms/resumo-do-setor.component";
import { ResumoDoSetorPage } from "@/presentation/components/pages/resumo-do-setor.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";
import { carregarResumoSetorRh } from "@/modules/clientes/presentation/view-models/resumo-setor-rh/resumo-setor-rh.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";

export default async function Page() {
  const sessao = await exigirSessao();

  // Admin vê (suporte a qualquer setor); funcionário de outro setor volta para o início.
  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, "rh")) redirect("/");

  const [setores, resumo] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarResumoSetorRh(),
  ]);

  return (
    <ResumoDoSetorPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} rotaAtual="/rh" />}
      erro={resumo.ok ? undefined : "Falha ao carregar o resumo do setor. Tente novamente."}
      resumo={
        resumo.ok && (
          <ResumoDoSetor
            cards={resumo.value.cards}
            grupos={resumo.value.grupos}
            hrefBase="/rh/resumo"
            totalClientes={resumo.value.totalClientes}
            busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
          />
        )
      }
      comparativos={
        resumo.ok &&
        resumo.value.comparativos && (
          <ComparativosRh
            responsaveis={resumo.value.comparativos.responsaveis}
            totalClientes={resumo.value.totalClientes}
          />
        )
      }
    />
  );
}
