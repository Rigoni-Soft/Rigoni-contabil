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

export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  // Resumo do setor é exclusivo do Simples Nacional (spec #24/#36) — Admin
  // também vê, mesmo raciocínio de acesso irrestrito já usado em
  // podeEditarCadastroOperacional (acesso de suporte a qualquer setor).
  const vePainelSn = sessao.papel === "admin" || sessao.setor === "simples_nacional";

  const [setores, resumo] = await Promise.all([
    carregarSetoresDaNavegacao(),
    vePainelSn ? carregarResumoSetorSn() : null,
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
      <main className="space-y-8 px-4 py-6 sm:px-6">
        {vePainelSn && (
          <div className="mx-auto max-w-4xl">
            {resumo?.ok ? (
              <ResumoSetorSn
                cards={resumo.value.cards}
                totalClientes={resumo.value.totalClientes}
              />
            ) : (
              <p role="alert" className="text-sm text-destructive">
                Falha ao carregar o resumo do setor. Tente novamente.
              </p>
            )}
          </div>
        )}
        <div className="mx-auto max-w-2xl">
          <BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />
        </div>
      </main>
    </>
  );
}
