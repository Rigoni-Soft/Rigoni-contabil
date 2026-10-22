import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { PerfilPage } from "@/presentation/components/pages/perfil.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { TrocarSenhaContainer } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  // Senha provisória: o fluxo obrigatório tem prioridade sobre o perfil.
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  return (
    <PerfilPage
      nome={sessao.nome}
      email={sessao.email}
      papel={sessao.papel}
      setor={sessao.setor}
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer papel={sessao.papel} />}
        />
      }
      formulario={<TrocarSenhaContainer />}
    />
  );
}
