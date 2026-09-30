import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";

export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

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
        <BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />
      </main>
    </>
  );
}
