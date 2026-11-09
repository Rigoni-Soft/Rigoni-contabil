import { redirect } from "next/navigation";

import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { ServicosDoAcompanhamentoContainer } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/servicos-do-acompanhamento.container";
import { configuracoesDoRh } from "@/modules/rh/presentation/view-models/resumo-rh/resumo-rh.presenter";
import { podeGerirServicosRh } from "@/shared/kernel/papeis";
import { ROTA_RH } from "@/shared/kernel/setores";

// Os serviços do acompanhamento definem os cards do dashboard do RH; só o Líder os mantém.
export default async function Page() {
  const sessao = await exigirSessao();
  if (!podeGerirServicosRh(sessao.papel, sessao.setor)) redirect("/");

  const [setores, acompanhamento] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarAcompanhamentoMensal(),
  ]);

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={
        <ShellNavContainer
          setores={setores}
          rotaAtual={ROTA_RH}
          configuracoes={configuracoesDoRh(
            podeGerirServicosRh(sessao.papel, sessao.setor),
            ROTA_RH,
          )}
        />
      }
      titulo="Serviços do acompanhamento"
      voltarHref={ROTA_RH}
      erro={acompanhamento.ok ? undefined : acompanhamento.error.message}
      tentarNovamenteHref={`${ROTA_RH}/servicos`}
      conteudo={
        acompanhamento.ok && (
          <ServicosDoAcompanhamentoContainer servicos={acompanhamento.value.servicos} />
        )
      }
    />
  );
}
