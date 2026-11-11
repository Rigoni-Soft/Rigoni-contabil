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
  searchParams: Promise<{ mes?: string; quinzena?: string }>;
};

// O Cartão de ponto de um empregado numa quinzena, com a Totalização: tela própria, fora do quadro.
export default async function Page({ params, searchParams }: Props) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const { cliente: clienteId, empregado } = await params;
  const { mes, quinzena } = await searchParams;
  const folha = await carregarFolhaDePonto({
    clienteId,
    competencia: mes,
    quinzena: quinzena === "1" ? 1 : quinzena === "2" ? 2 : undefined,
    empregadoId: empregado,
  });
  const voltarHref = hrefDaFolha(clienteId, { empregado });

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      largura="cadastro"
      titulo="Cartão de ponto"
      voltarHref={voltarHref}
      erro={folha.ok ? undefined : folha.error.message}
      tentarNovamenteHref={voltarHref}
      conteudo={folha.ok && <CartaoDePontoContainer folha={folha.value} />}
    />
  );
}
