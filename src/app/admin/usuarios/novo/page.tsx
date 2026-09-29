import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { CriarUsuarioPage } from "@/presentation/components/pages/criar-usuario.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { CriarUsuarioContainer } from "@/modules/usuarios/presentation/view-models/criar-usuario/criar-usuario.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.papel !== "admin") redirect("/");

  return (
    <CriarUsuarioPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      formulario={<CriarUsuarioContainer />}
    />
  );
}
