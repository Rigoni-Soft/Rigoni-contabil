import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { CriarUsuarioPage } from "@/presentation/components/pages/criar-usuario.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { CriarUsuarioContainer } from "@/modules/usuarios/presentation/view-models/criar-usuario/criar-usuario.container";
import type { PapelCadastravel } from "@/shared/kernel/papeis";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (sessao.papel !== "admin" && sessao.papel !== "lider_setor") redirect("/");

  // Já escopado por RBAC no caso de uso (Admin vê tudo, Líder só o próprio Setor).
  const setores = await carregarSetoresDaNavegacao();
  const papeisDisponiveis: PapelCadastravel[] =
    sessao.papel === "admin" ? ["lider_setor", "funcionario"] : ["funcionario"];

  return (
    <CriarUsuarioPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer papel={sessao.papel} />}
        />
      }
      formulario={
        <CriarUsuarioContainer
          papeisDisponiveis={papeisDisponiveis}
          setoresDisponiveis={setores.map((setor) => setor.slug)}
        />
      }
    />
  );
}
