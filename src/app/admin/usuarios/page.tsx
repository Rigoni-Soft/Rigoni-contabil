import { redirect } from "next/navigation";

import { GrupoDeAcoes } from "@/presentation/components/atoms/grupo-de-acoes.component";
import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { UsuariosLista } from "@/presentation/components/organisms/usuarios-lista.component";
import { UsuariosListaPage } from "@/presentation/components/pages/usuarios-lista.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { AlterarPapelContainer } from "@/modules/usuarios/presentation/view-models/alterar-papel/alterar-papel.container";
import { DesativarUsuarioContainer } from "@/modules/usuarios/presentation/view-models/desativar-usuario/desativar-usuario.container";
import { carregarUsuarios } from "@/modules/usuarios/presentation/view-models/listar-usuarios/listar-usuarios.server";

export default async function Page() {
  const [sessao, usuarios] = await Promise.all([carregarSessao(), carregarUsuarios()]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!usuarios.ok) redirect("/");

  return (
    <UsuariosListaPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      lista={
        <UsuariosLista
          usuarios={usuarios.value}
          // Admin nunca é desativado nem muda de papel pela UI: a linha dele fica sem ação.
          acoes={(u) =>
            u.papel === "admin" ? null : (
              <GrupoDeAcoes>
                {!u.bloqueioPendente && (
                  <AlterarPapelContainer usuarioId={u.id} nome={u.nome} papel={u.papel} />
                )}
                <DesativarUsuarioContainer
                  usuarioId={u.id}
                  nome={u.nome}
                  bloqueioPendente={u.bloqueioPendente}
                />
              </GrupoDeAcoes>
            )
          }
        />
      }
    />
  );
}
