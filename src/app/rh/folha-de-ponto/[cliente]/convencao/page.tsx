import { redirect } from "next/navigation";

import { HistoricoDeConvencoes } from "@/presentation/components/organisms/historico-de-convencoes.component";
import { RegrasAplicadas } from "@/presentation/components/organisms/regras-aplicadas.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { AjustesDoClienteNaConvencaoContainer } from "@/modules/rh/presentation/view-models/convencao/ajustes-do-cliente-na-convencao.container";
import {
  convencaoEscolhida,
  historicoDeConvencoes,
  linhasDeRegras,
  tituloDaConvencao,
} from "@/modules/rh/presentation/view-models/convencao/convencao.presenter";
import { carregarConvencoes } from "@/modules/rh/presentation/view-models/convencao/convencao.server";
import { EnvioDeConvencaoContainer } from "@/modules/rh/presentation/view-models/convencao/envio-de-convencao.container";
import { configuracoesDoRh } from "@/modules/rh/presentation/view-models/resumo-rh/resumo-rh.presenter";
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { ROTA_RH, ROTA_RH_FOLHA_DE_PONTO } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ cliente: string }>;
  searchParams: Promise<{ convencao?: string }>;
};

// A Convenção coletiva de um Cliente: envio e renovação (Líder do RH e Admin), o histórico, as "Regras
// aplicadas" da convenção escolhida, em leitura, e os ajustes do Cliente.
export default async function Page({ params, searchParams }: Props) {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const { cliente: clienteId } = await params;
  const { convencao } = await searchParams;
  const rota = `${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}/convencao`;
  const [setores, dados] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarConvencoes(clienteId),
  ]);
  const escolhida = dados.ok ? convencaoEscolhida(dados.value.convencoes, convencao) : undefined;

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={
        <ShellNavContainer
          setores={setores}
          rotaAtual={ROTA_RH}
          configuracoes={configuracoesDoRh(sessao.papel, sessao.setor)}
        />
      }
      titulo="Convenção coletiva"
      voltarHref={`${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}`}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={rota}
      conteudo={
        dados.ok && (
          <>
            <HistoricoDeConvencoes
              itens={historicoDeConvencoes(dados.value.convencoes, escolhida?.id, rota)}
              podeEnviar={dados.value.podeEnviar}
            />
            {dados.value.podeEnviar && <EnvioDeConvencaoContainer clienteId={clienteId} />}
            {escolhida && (
              <RegrasAplicadas
                titulo={tituloDaConvencao(escolhida)}
                linhas={linhasDeRegras(escolhida)}
              />
            )}
            <AjustesDoClienteNaConvencaoContainer dados={dados.value} />
          </>
        )
      }
    />
  );
}
