import { redirect } from "next/navigation";

import { ResumoSetorSn } from "@/presentation/components/organisms/resumo-setor-sn.component";
import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { BuscarClienteContainer } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.container";
import { carregarResumoSetorSn } from "@/modules/clientes/presentation/view-models/resumo-setor-sn/resumo-setor-sn.server";

// Dashboard exclusivo do Simples Nacional (#36, feedback de teste manual,
// ponto 1): deixou de ser embutido em "/" — só aparece aqui, alcançado pela
// aba "Simples Nacional" do ShellNav (ponto 2).
export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  // Admin vê (acesso de suporte a qualquer setor, mesmo raciocínio de
  // podeEditarCadastroOperacional); qualquer outro setor fora do SN não.
  if (sessao.papel !== "admin" && sessao.setor !== "simples_nacional") redirect("/");

  const [setores, resumo] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarResumoSetorSn(),
  ]);

  return (
    <>
      <ShellHeader
        nome={sessao.nome}
        papel={sessao.papel}
        setor={sessao.setor}
        sair={<LogoutButtonContainer />}
      />
      <ShellNav setores={setores} />
      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto w-[90%]">
          {resumo.ok ? (
            <ResumoSetorSn
              cards={resumo.value.cards}
              totalClientes={resumo.value.totalClientes}
              busca={
                <BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} apenasSnMei />
              }
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Falha ao carregar o resumo do setor. Tente novamente.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
