import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { CriarUsuarioPage } from "@/presentation/components/pages/criar-usuario.page";
import { Button } from "@/presentation/components/ui/button";
import { logoutAction } from "@/presentation/view-models/shell/logout.actions";
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
          sair={
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden="true" />
                Sair
              </Button>
            </form>
          }
        />
      }
      formulario={<CriarUsuarioContainer />}
    />
  );
}
