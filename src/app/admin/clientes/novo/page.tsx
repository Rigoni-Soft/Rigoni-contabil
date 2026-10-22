import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { CriarClientePage } from "@/presentation/components/pages/criar-cliente.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { CriarClienteContainer } from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (sessao.papel !== "admin") redirect("/");

  return (
    <CriarClientePage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer papel={sessao.papel} />}
        />
      }
      formulario={<CriarClienteContainer />}
    />
  );
}
