import { notFound, redirect } from "next/navigation";

import { DetalheDoFuncionarioRh } from "@/presentation/components/organisms/detalhe-do-funcionario-rh.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarAcompanhamentoFuncionarios } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.server";
import { rotuloDaCompetencia } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { podeVerAcompanhamentoDosFuncionariosRh } from "@/shared/kernel/papeis";
import { ROTA_RH } from "@/shared/kernel/setores";

const ROTA = `${ROTA_RH}/funcionarios`;
const percentual = (pontos: number, atribuidos: number) =>
  atribuidos === 0 ? 0 : Math.round((pontos / atribuidos) * 100);

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { mes }] = await Promise.all([params, searchParams]);
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoDosFuncionariosRh(sessao.papel, sessao.setor)) redirect("/");

  const [setores, dados] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarAcompanhamentoFuncionarios(mes, id),
  ]);
  if (dados.ok && !dados.value.detalhe) notFound();
  const detalhe = dados.ok ? dados.value.detalhe : undefined;
  const competencia = dados.ok ? dados.value.competencia : undefined;
  const query = competencia ? `?mes=${competencia}` : "";
  const rotaDoFuncionario = `${ROTA}/${encodeURIComponent(id)}`;

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} rotaAtual={ROTA_RH} />}
      titulo="Acompanhamento do funcionário"
      voltarHref={`${ROTA}${query}`}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={`${rotaDoFuncionario}${query}`}
      conteudo={
        detalhe &&
        competencia && (
          <DetalheDoFuncionarioRh
            nome={detalhe.funcionario.nome}
            rotuloMes={rotuloDaCompetencia(competencia)}
            pontos={detalhe.funcionario.pontos}
            atribuidos={detalhe.funcionario.atribuidos}
            percentual={percentual(detalhe.funcionario.pontos, detalhe.funcionario.atribuidos)}
            pendencias={detalhe.pendencias}
            evolucao={detalhe.evolucao.map((m) => ({
              competencia: m.competencia,
              rotulo: rotuloDaCompetencia(m.competencia),
              percentual: percentual(m.pontos, m.atribuidos),
            }))}
            maisAtrasados={detalhe.maisAtrasados}
          />
        )
      }
    />
  );
}
