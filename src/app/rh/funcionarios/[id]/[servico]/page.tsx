import { notFound, redirect } from "next/navigation";

import { ResumoSetorLista } from "@/presentation/components/organisms/resumo-setor-lista.component";
import { ResumoSetorListaPage } from "@/presentation/components/pages/resumo-setor-lista.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { tituloDaListaDeFalta } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.presenter";
import { carregarAcompanhamentoFuncionarios } from "@/modules/rh/presentation/view-models/acompanhamento-funcionarios/acompanhamento-funcionarios.server";
import { podeVerAcompanhamentoDosFuncionariosRh } from "@/shared/kernel/papeis";
import { ROTA_RH_FUNCIONARIOS } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ id: string; servico: string }>;
  searchParams: Promise<{ mes?: string }>;
};

// As empresas de um Funcionário que ainda faltam num serviço no mês (a célula da tabela de faltas).
// ponytail: o "Voltar" da tela do Cliente traz de volta a esta lista no mês atual, sem o ?mes= consultado.
export default async function Page({ params, searchParams }: Props) {
  const [{ id, servico: servicoId }, { mes }] = await Promise.all([params, searchParams]);
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoDosFuncionariosRh(sessao.papel, sessao.setor)) redirect("/");

  const dados = await carregarAcompanhamentoFuncionarios(mes, id);
  if (dados.ok && !dados.value.detalhe) notFound();
  const detalhe = dados.ok ? dados.value.detalhe : undefined;
  const pendencia = detalhe?.pendencias.find((p) => p.servicoId === servicoId);
  const titulo = dados.ok ? tituloDaListaDeFalta(dados.value, id, servicoId) : undefined;
  if (dados.ok && !titulo) notFound();
  const rotaDoFuncionario = `${ROTA_RH_FUNCIONARIOS}/${encodeURIComponent(id)}`;
  const query = dados.ok ? `?mes=${dados.value.competencia}` : "";

  return (
    <ResumoSetorListaPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={titulo ?? "Acompanhamento do funcionário"}
      voltarHref={ROTA_RH_FUNCIONARIOS}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={`${rotaDoFuncionario}/${encodeURIComponent(servicoId)}${query}`}
      lista={
        <ResumoSetorLista
          clientes={pendencia?.clientes ?? []}
          bucket={servicoId}
          vazio="Nenhum cliente com este serviço pendente neste mês."
          rotaBase={rotaDoFuncionario}
        />
      }
    />
  );
}
