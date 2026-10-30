import { redirect } from "next/navigation";

import { GrupoDeAcoes } from "@/presentation/components/atoms/grupo-de-acoes.component";
import { UsuariosLista } from "@/presentation/components/organisms/usuarios-lista.component";
import { UsuariosListaPage } from "@/presentation/components/pages/usuarios-lista.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { AlterarPapelContainer } from "@/modules/usuarios/presentation/view-models/alterar-papel/alterar-papel.container";
import { DesativarUsuarioContainer } from "@/modules/usuarios/presentation/view-models/desativar-usuario/desativar-usuario.container";
import { carregarUsuarios } from "@/modules/usuarios/presentation/view-models/listar-usuarios/listar-usuarios.server";

export default async function Page() {
  const [sessaoOuNula, usuarios] = await Promise.all([carregarSessao(), carregarUsuarios()]);
  const sessao = validarSessao(sessaoOuNula);
  if (!usuarios.ok) redirect("/");

  return (
    <UsuariosListaPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
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
