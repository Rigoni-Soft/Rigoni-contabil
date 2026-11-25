import { redirect } from "next/navigation";

import { HomePage } from "@/presentation/components/pages/home.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { ShellNavContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/shell-nav.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";
import { escopoDoUsuario } from "@/shared/kernel/escopo-do-usuario";

export default async function Home() {
  const sessao = await exigirSessao();
  const { home } = escopoDoUsuario(sessao);
  if (home !== "/") redirect(home);

  const setores = await carregarSetoresDaNavegacao();

  return (
    <HomePage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      nav={<ShellNavContainer setores={setores} />}
      busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
    />
  );
}
