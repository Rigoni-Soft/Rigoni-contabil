import { redirect } from "next/navigation";

import { CriarUsuarioPage } from "@/presentation/components/pages/criar-usuario.page";
import {
  carregarSetoresDaNavegacao,
  exigirSessao,
} from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { CriarUsuarioContainer } from "@/modules/usuarios/presentation/view-models/criar-usuario/criar-usuario.container";
import type { PapelCadastravel } from "@/shared/kernel/papeis";

export default async function Page() {
  const sessao = await exigirSessao();
  if (sessao.papel !== "admin" && sessao.papel !== "lider_setor") redirect("/");

  // Já escopado por RBAC no caso de uso (Admin vê tudo, Líder só o próprio Setor).
  const setores = await carregarSetoresDaNavegacao();
  const papeisDisponiveis: PapelCadastravel[] =
    sessao.papel === "admin" ? ["lider_setor", "funcionario"] : ["funcionario"];

  return (
    <CriarUsuarioPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      formulario={
        <CriarUsuarioContainer
          papeisDisponiveis={papeisDisponiveis}
          setoresDisponiveis={setores.map((setor) => setor.slug)}
        />
      }
    />
  );
}
