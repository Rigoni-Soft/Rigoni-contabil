import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { TrocarSenhaPage } from "@/presentation/components/pages/trocar-senha.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { TrocarSenhaContainer } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");

  return (
    <TrocarSenhaPage
      obrigatoria={sessao.precisaTrocarSenha}
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      formulario={<TrocarSenhaContainer />}
    />
  );
}
