import { redirect } from "next/navigation";

import { ListaDeClientes } from "@/presentation/components/molecules/lista-de-clientes.component";
import { AcompanhamentoMensalPage } from "@/presentation/components/pages/acompanhamento-mensal.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { hrefDaFolha } from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.presenter";
import { configuracoesDoRh } from "@/modules/rh/presentation/view-models/resumo-rh/resumo-rh.presenter";
import { podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { ROTA_RH, ROTA_RH_FOLHA_DE_PONTO } from "@/shared/kernel/setores";

// Os clientes do RH (o Funcionário vê os dele; o Líder e o Admin, todos): cada um abre a Folha de ponto.
export default async function Page() {
  const sessao = await exigirSessao();
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) redirect("/");

  const [setores, acompanhamento] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarAcompanhamentoMensal(),
  ]);

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
      titulo="Folha de ponto"
      voltarHref={ROTA_RH}
      erro={acompanhamento.ok ? undefined : acompanhamento.error.message}
      tentarNovamenteHref={ROTA_RH_FOLHA_DE_PONTO}
      conteudo={
        acompanhamento.ok && (
          <ListaDeClientes
            clientes={acompanhamento.value.linhas.map((l) => ({
              clienteId: l.clienteId,
              empresa: l.empresa,
              cnpj: l.cnpj,
              href: hrefDaFolha(l.clienteId, {}),
              acao: "Abrir folha →",
            }))}
          />
        )
      }
    />
  );
}
