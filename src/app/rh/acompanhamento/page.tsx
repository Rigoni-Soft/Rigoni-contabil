import { redirect } from "next/navigation";

import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { AcompanhamentoMensalContainer } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.container";
import {
  linhasDaTabela,
  mesVizinho,
  rotuloDaCompetencia,
} from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { mesAtual } from "@/shared/kernel/mes-atual";
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { ROTA_RH } from "@/shared/kernel/setores";

const ROTA = `${ROTA_RH}/acompanhamento`;

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const { mes } = await searchParams;
  const [setores, acompanhamento] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarAcompanhamentoMensal(mes),
  ]);

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} rotaAtual={ROTA_RH} />}
      titulo="Acompanhamento mensal"
      voltarHref={ROTA_RH}
      erro={acompanhamento.ok ? undefined : acompanhamento.error.message}
      tentarNovamenteHref={ROTA}
      conteudo={
        acompanhamento.ok && (
          <AcompanhamentoMensalContainer
            competencia={acompanhamento.value.competencia}
            rotuloCompetencia={rotuloDaCompetencia(acompanhamento.value.competencia)}
            anteriorHref={`${ROTA}?mes=${mesVizinho(acompanhamento.value.competencia, -1)}`}
            proximoHref={
              acompanhamento.value.competencia < mesAtual()
                ? `${ROTA}?mes=${mesVizinho(acompanhamento.value.competencia, 1)}`
                : undefined
            }
            servicos={acompanhamento.value.servicos}
            linhas={linhasDaTabela(acompanhamento.value)}
            podeMarcar={acompanhamento.value.podeMarcar}
            podeGerirServicos={
              acompanhamento.value.podeGerirServicos &&
              acompanhamento.value.competencia === mesAtual()
            }
          />
        )
      }
    />
  );
}
