import { redirect } from "next/navigation";

import { AcompanhamentoDosFuncionarios } from "@/presentation/components/organisms/acompanhamento-dos-funcionarios.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarAcompanhamentoFuncionarios } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.server";
import {
  mesVizinho,
  rotuloDaCompetencia,
} from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { mesAtual } from "@/shared/kernel/mes-atual";
import { podeVerAcompanhamentoDosFuncionariosRh } from "@/shared/kernel/papeis";
import { ROTA_RH } from "@/shared/kernel/setores";

const ROTA = `${ROTA_RH}/funcionarios`;

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
      nav={<ShellNavContainer setores={setores} rotaAtual={ROTA_RH} />}
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
            funcionarios={dados.value.funcionarios.map((f) => ({
              ...f,
              href: `${ROTA}/${f.id}?mes=${dados.value.competencia}`,
            }))}
            semResponsavel={dados.value.semResponsavel.map((c) => c.empresa)}
          />
        )
      }
    />
  );
}
