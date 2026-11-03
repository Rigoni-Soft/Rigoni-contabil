import { redirect } from "next/navigation";

import { ComparativosSn } from "@/presentation/components/organisms/comparativos-sn.component";
import { ResumoDoSetor } from "@/presentation/components/organisms/resumo-do-setor.component";
import { ResumoDoSetorPage } from "@/presentation/components/pages/resumo-do-setor.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";
import { carregarResumoSetorSn } from "@/modules/clientes/presentation/view-models/resumo-setor-sn/resumo-setor-sn.server";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";

export default async function Page() {
  const sessao = await exigirSessao();

  // Admin vê (acesso de suporte a qualquer setor, mesmo raciocínio de
  // podeEditarCadastroOperacional); qualquer outro setor fora do SN não.
  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, "simples_nacional")) redirect("/");

  const [setores, resumo] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarResumoSetorSn(),
  ]);

  return (
    <ResumoDoSetorPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} rotaAtual="/simples-nacional" />}
      erro={resumo.ok ? undefined : "Falha ao carregar o resumo do setor. Tente novamente."}
      resumo={
        resumo.ok && (
          <ResumoDoSetor
            cards={resumo.value.cards}
            grupos={resumo.value.grupos}
            hrefBase="/clientes/resumo"
            totalClientes={resumo.value.totalClientes}
            busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} apenasSnMei />}
          />
        )
      }
      comparativos={
        resumo.ok && (
          <ComparativosSn
            comparativos={resumo.value.comparativos}
            responsaveis={resumo.value.comparativos.responsaveis}
            totalClientes={resumo.value.totalClientes}
          />
        )
      }
    />
  );
}
