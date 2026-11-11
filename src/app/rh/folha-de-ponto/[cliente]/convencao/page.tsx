import { redirect } from "next/navigation";

import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { HistoricoDeConvencoes } from "@/presentation/components/organisms/historico-de-convencoes.component";
import { RegrasAplicadas } from "@/presentation/components/organisms/regras-aplicadas.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
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
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { ROTA_RH_FOLHA_DE_PONTO } from "@/shared/kernel/setores";

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
  const dados = await carregarConvencoes(clienteId);
  const escolhida = dados.ok ? convencaoEscolhida(dados.value.convencoes, convencao) : undefined;

  return (
    <AcompanhamentoMensalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      largura="cadastro"
      titulo="Convenção coletiva"
      voltarHref={`${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}`}
      erro={dados.ok ? undefined : dados.error.message}
      tentarNovamenteHref={rota}
      conteudo={
        dados.ok && (
          <>
            <Pilha espaco={6} className={MOLDURA_DO_CARTAO}>
              <HistoricoDeConvencoes
                itens={historicoDeConvencoes(dados.value.convencoes, escolhida?.id, rota)}
                podeEnviar={dados.value.podeEnviar}
              />
            </Pilha>
            {dados.value.podeEnviar && (
              <Pilha espaco={6} className={MOLDURA_DO_CARTAO}>
                <EnvioDeConvencaoContainer clienteId={clienteId} />
              </Pilha>
            )}
            {escolhida && (
              <Pilha espaco={6} className={MOLDURA_DO_CARTAO}>
                <RegrasAplicadas
                  titulo={tituloDaConvencao(escolhida)}
                  linhas={linhasDeRegras(escolhida)}
                />
              </Pilha>
            )}
            <Pilha espaco={6} className={MOLDURA_DO_CARTAO}>
              <AjustesDoClienteNaConvencaoContainer dados={dados.value} />
            </Pilha>
          </>
        )
      }
    />
  );
}
