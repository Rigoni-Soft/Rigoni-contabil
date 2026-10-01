import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";

// "/" é a home genérica — só pra quem não tem um dashboard de setor próprio
// ainda. O dashboard de cada setor é a página principal de quem é DAQUELE
// setor (feedback de teste manual): Funcionário/Líder do Simples Nacional cai
// direto em /simples-nacional ao entrar, não precisa clicar na aba. Admin não
// pertence a um setor operacional — continua em "/" com a busca geral, sem
// restrição de Regime, e alcança qualquer setor pela aba do ShellNav.
export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (sessao.setor === "simples_nacional") redirect("/simples-nacional");

  const setores = await carregarSetoresDaNavegacao();

  return (
    <>
      <ShellHeader
        nome={sessao.nome}
        papel={sessao.papel}
        setor={sessao.setor}
        sair={<LogoutButtonContainer />}
      />
      <ShellNav setores={setores} />
      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto w-[90%]">
          <BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />
        </div>
      </main>
    </>
  );
}
