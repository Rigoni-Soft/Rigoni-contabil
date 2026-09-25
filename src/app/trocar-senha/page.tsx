import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { TrocarSenhaPage } from "@/presentation/components/pages/trocar-senha.page";
import { Button } from "@/presentation/components/ui/button";
import { logoutAction } from "@/presentation/view-models/shell/logout.actions";
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
      formulario={<TrocarSenhaContainer />}
    />
  );
}
