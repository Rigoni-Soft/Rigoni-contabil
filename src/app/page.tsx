import { redirect } from "next/navigation";

import { HomePage } from "@/presentation/components/pages/home.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";

// "/" é a home genérica — só pra quem não tem um dashboard de setor próprio ainda. O dashboard de
// cada setor é a página principal de quem é DAQUELE setor: Funcionário/Líder do Simples Nacional
// cai direto em /simples-nacional ao entrar. Admin não pertence a um setor operacional — continua
// em "/" com a busca geral, sem restrição de Regime, e alcança qualquer setor pela aba do ShellNav.
export default async function Home() {
  const sessao = await exigirSessao();
  if (sessao.setor === "simples_nacional") redirect("/simples-nacional");

  const setores = await carregarSetoresDaNavegacao();

  return (
    <HomePage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} />}
      busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
    />
  );
}
