import { redirect } from "next/navigation";

import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ComparativosRh } from "@/presentation/components/organisms/comparativos-rh.component";
import { ResumoDoSetor } from "@/presentation/components/organisms/resumo-do-setor.component";
import { ResumoDoSetorPage } from "@/presentation/components/pages/resumo-do-setor.page";
import { ERRO_CARREGAR_RESUMO_SETOR } from "@/presentation/lib/erro-resumo-setor";
import { juntarResumoRh } from "@/presentation/lib/juntar-resumo-rh";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";
import { carregarResumoSetorRh } from "@/modules/clientes/presentation/view-models/resumo-setor-rh/resumo-setor-rh.server";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import {
  cardsDoAcompanhamento,
  configuracoesDoRh,
  fatiasDoAcompanhamento,
} from "@/modules/rh/presentation/view-models/resumo-rh/resumo-rh.presenter";
import { podeVerDashboardDoSetor } from "@/shared/kernel/papeis";
import { ROTA_RH, ROTA_RH_FOLHA_DE_PONTO, SETOR_RH } from "@/shared/kernel/setores";

// ponytail: montagem repetida de app/simples-nacional/page.tsx; extrair no 3º Setor com resumo.
export default async function Page() {
  const sessao = await exigirSessao();

  // Admin vê (suporte a qualquer setor); funcionário de outro setor volta para o início.
  if (!podeVerDashboardDoSetor(sessao.papel, sessao.setor, SETOR_RH)) redirect("/");

  // ponytail: este carregamento repete o de app/rh/resumo/[bucket]; sem lugar para dividir (app só tem
  // arquivos do Next e as camadas não se importam), junta-se na página.
  const [setores, base, mensal] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarResumoSetorRh(),
    carregarAcompanhamentoMensal(),
  ]);
  // Se o acompanhamento falhar, o dashboard segue só com o Parcelamento e avisa.
  const resumo = base.ok
    ? {
        ok: true as const,
        value: juntarResumoRh(
          base.value,
          mensal.ok ? cardsDoAcompanhamento(mensal.value) : undefined,
        ),
      }
    : { ok: false as const };

  return (
    <ResumoDoSetorPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={
        <ShellNavContainer
          setores={setores}
          rotaAtual={ROTA_RH}
          configuracoes={configuracoesDoRh(sessao.papel, sessao.setor)}
        />
      }
      erro={resumo.ok ? undefined : ERRO_CARREGAR_RESUMO_SETOR}
      tentarNovamenteHref={ROTA_RH}
      resumo={
        resumo.ok && (
          <ResumoDoSetor
            cards={resumo.value.cards}
            grupos={resumo.value.grupos}
            hrefBase={`${ROTA_RH}/resumo`}
            totalClientes={resumo.value.totalClientes}
            busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
          />
        )
      }
      acoes={
        <>
          <LinkDeAcao href={ROTA_RH_FOLHA_DE_PONTO} className="self-start">
            Folha de ponto
          </LinkDeAcao>
          {!mensal.ok && (
            <Texto variante="alerta" role="alert">
              Não foi possível carregar o acompanhamento. Recarregue a página.
            </Texto>
          )}
        </>
      }
      comparativos={
        resumo.ok &&
        mensal.ok && (
          <ComparativosRh
            acompanhamento={fatiasDoAcompanhamento(mensal.value)}
            parcelamento={resumo.value.comparativos.parcelamento}
            responsaveis={resumo.value.comparativos.responsaveis}
            totalClientes={resumo.value.totalClientes}
          />
        )
      }
    />
  );
}
