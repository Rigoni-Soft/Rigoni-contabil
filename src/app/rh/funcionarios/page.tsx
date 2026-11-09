import { redirect } from "next/navigation";

import { AcompanhamentoDosFuncionarios } from "@/presentation/components/organisms/acompanhamento-dos-funcionarios.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import {
  funcionariosDoGrafico,
  semResponsavelDoGrafico,
} from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.presenter";
import { carregarAcompanhamentoFuncionarios } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.server";
import {
  mesVizinho,
  rotuloDaCompetencia,
} from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { configuracoesDoRh } from "@/modules/rh/presentation/view-models/resumo-rh/resumo-rh.presenter";
import { mesAtual } from "@/shared/kernel/mes-atual";
import {
  podeGerirServicosRh,
  podeVerAcompanhamentoDosFuncionariosRh,
} from "@/shared/kernel/papeis";
import { ROTA_RH, ROTA_RH_FUNCIONARIOS } from "@/shared/kernel/setores";

const ROTA = ROTA_RH_FUNCIONARIOS;

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoDosFuncionariosRh(sessao.papel, sessao.setor)) redirect("/");

  const { mes } = await searchParams;
  const [setores, dados] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarAcompanhamentoFuncionarios(mes),
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
      titulo="Acompanhamento dos funcionários"
      voltarHref={ROTA_RH}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={ROTA}
      conteudo={
        dados.ok && (
          <AcompanhamentoDosFuncionarios
            rotuloMes={rotuloDaCompetencia(dados.value.competencia)}
            anteriorHref={`${ROTA}?mes=${mesVizinho(dados.value.competencia, -1)}`}
            proximoHref={
              dados.value.competencia < mesAtual()
                ? `${ROTA}?mes=${mesVizinho(dados.value.competencia, 1)}`
                : undefined
            }
            funcionarios={funcionariosDoGrafico(dados.value, ROTA)}
            semResponsavel={semResponsavelDoGrafico(dados.value, ROTA)}
          />
        )
      }
    />
  );
}
