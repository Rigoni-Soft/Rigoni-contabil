// Temporário — remover quando #35 (Busca de cliente no dashboard) existir.
// Atalho de dev pra chegar em /clientes/[id] sem lista/busca ainda: o id se
// pega no Supabase Studio (tabela `clientes`) enquanto não há UI pra isso.
import { redirect } from "next/navigation";

import { IrParaClienteContainer } from "@/presentation/view-models/dev/ir-para-cliente.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-primary">Ir pra cliente (dev)</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Atalho temporário — cole o id do cliente (tabela `clientes` no Supabase Studio).
      </p>
      <IrParaClienteContainer />
    </main>
  );
}
