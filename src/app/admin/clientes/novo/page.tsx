import { redirect } from "next/navigation";

import { CriarClientePage } from "@/presentation/components/pages/criar-cliente.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { CriarClienteContainer } from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.container";

export default async function Page() {
  const sessao = await exigirSessao();
  if (sessao.papel !== "admin") redirect("/");

  return (
    <CriarClientePage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      formulario={<CriarClienteContainer />}
    />
  );
}
