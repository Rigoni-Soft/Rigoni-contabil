import { redirect } from "next/navigation";

import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { CartaoDePontoContainer } from "@/modules/rh/presentation/view-models/folha-de-ponto/cartao-de-ponto.container";
import { hrefDaFolha } from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.presenter";
import { carregarFolhaDePonto } from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.server";
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";

type Props = {
  params: Promise<{ cliente: string; empregado: string }>;
  searchParams: Promise<{ mes?: string }>;
};

// O Cartão de ponto de um empregado no mês inteiro, com a Totalização: tela própria, fora do quadro.
export default async function Page({ params, searchParams }: Props) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const { cliente: clienteId, empregado } = await params;
  const { mes } = await searchParams;
  const folha = await carregarFolhaDePonto({
    clienteId,
    competencia: mes,
    empregadoId: empregado,
  });
  const voltarHref = hrefDaFolha(clienteId, { empregado });

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      // Tabela de muitas colunas, como a planilha: largura de conteúdo, não a do formulário.
      largura="conteudo"
      titulo="Cartão de ponto"
      voltarHref={voltarHref}
      erro={folha.ok ? undefined : folha.error.message}
      tentarNovamenteHref={voltarHref}
      conteudo={folha.ok && <CartaoDePontoContainer folha={folha.value} />}
    />
  );
}
