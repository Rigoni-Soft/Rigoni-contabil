import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { HomePage } from "@/presentation/components/pages/home.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";

// "/" é a home genérica — só pra quem não tem um dashboard de setor próprio ainda. O dashboard de
// cada setor é a página principal de quem é DAQUELE setor: Funcionário/Líder do Simples Nacional
// cai direto em /simples-nacional ao entrar. Admin não pertence a um setor operacional — continua
// em "/" com a busca geral, sem restrição de Regime, e alcança qualquer setor pela aba do ShellNav.
export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (sessao.setor === "simples_nacional") redirect("/simples-nacional");

  const setores = await carregarSetoresDaNavegacao();

  return (
    <HomePage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer />}
        />
      }
      nav={<ShellNav setores={setores} />}
      busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
    />
  );
}
