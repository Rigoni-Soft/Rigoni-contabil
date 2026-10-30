import { redirect } from "next/navigation";

import { TrocarSenhaPage } from "@/presentation/components/pages/trocar-senha.page";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { TrocarSenhaContainer } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.container";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  // Só a troca obrigatória vive aqui; a voluntária é do perfil.
  if (!sessao.precisaTrocarSenha) redirect("/perfil");

  return (
    <TrocarSenhaPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      formulario={<TrocarSenhaContainer />}
    />
  );
}
