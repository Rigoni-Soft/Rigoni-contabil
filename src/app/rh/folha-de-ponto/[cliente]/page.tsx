import { redirect } from "next/navigation";

import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { CartaoDaTela } from "@/presentation/components/molecules/cartao-da-tela.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarFolhaDePonto } from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.server";
import { LeituraDeCartaoContainer } from "@/modules/rh/presentation/view-models/folha-de-ponto/leitura-de-cartao.container";
import { QuadroDeFuncionariosContainer } from "@/modules/rh/presentation/view-models/folha-de-ponto/quadro-de-funcionarios.container";
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { ROTA_RH_FOLHA_DE_PONTO } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ cliente: string }>;
  searchParams: Promise<{ mes?: string; empregado?: string }>;
};

// A Folha de ponto de um Cliente: o quadro de funcionários (o cartão de cada empregado tem tela própria).
export default async function Page({ params, searchParams }: Props) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const { cliente: clienteId } = await params;
  const { mes, empregado } = await searchParams;
  const folha = await carregarFolhaDePonto({
    clienteId,
    competencia: mes,
    empregadoId: empregado,
  });

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      largura="cadastro"
      titulo="Folha de ponto"
      voltarHref={ROTA_RH_FOLHA_DE_PONTO}
      erro={folha.ok ? undefined : folha.error.message}
      tentarNovamenteHref={`${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}`}
      conteudo={
        folha.ok && (
          <>
            <LinkDeAcao
              href={`${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}/convencao`}
              className="self-start"
            >
              Convenção coletiva →
            </LinkDeAcao>
            <QuadroDeFuncionariosContainer folha={folha.value} />
            {folha.value.podeEditar && (
              <CartaoDaTela>
                <LeituraDeCartaoContainer
                  clienteId={folha.value.clienteId}
                  competencia={folha.value.competencia}
                />
              </CartaoDaTela>
            )}
          </>
        )
      }
    />
  );
}
