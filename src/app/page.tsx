import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { logoutAction } from "@/presentation/view-models/shell/logout.actions";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";

export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");

  return (
    <ShellHeader
      nome={sessao.nome}
      papel={sessao.papel}
      setor={sessao.setor}
      sair={
        <form action={logoutAction}>
          <button type="submit" className="text-sm underline">
            Sair
          </button>
        </form>
      }
    />
  );
}
