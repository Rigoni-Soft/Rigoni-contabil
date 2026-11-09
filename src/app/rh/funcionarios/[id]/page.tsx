import { notFound, redirect } from "next/navigation";

import { DetalheDoFuncionarioRh } from "@/presentation/components/organisms/detalhe-do-funcionario-rh.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { propsDoDetalhe } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.presenter";
import { carregarAcompanhamentoFuncionarios } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.server";
import { podeVerAcompanhamentoDosFuncionariosRh } from "@/shared/kernel/papeis";
import { ROTA_RH, ROTA_RH_FUNCIONARIOS } from "@/shared/kernel/setores";

const ROTA = ROTA_RH_FUNCIONARIOS;

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
  const query = dados.ok ? `?mes=${dados.value.competencia}` : "";
  const rotaDoFuncionario = `${ROTA}/${encodeURIComponent(id)}`;

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} rotaAtual={ROTA_RH} />}
      titulo="Acompanhamento do funcionário"
      voltarHref={ROTA}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={`${rotaDoFuncionario}${query}`}
      conteudo={
        dados.ok &&
        dados.value.detalhe && (
          <DetalheDoFuncionarioRh
            {...propsDoDetalhe(dados.value.detalhe, dados.value.competencia)}
          />
        )
      }
    />
  );
}
