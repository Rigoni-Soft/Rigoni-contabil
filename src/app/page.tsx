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
      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto w-[90%] space-y-8">
          {vePainelSn ? (
            resumo?.ok ? (
              <ResumoSetorSn
                cards={resumo.value.cards}
                totalClientes={resumo.value.totalClientes}
                busca={<BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />}
              />
            ) : (
              <p role="alert" className="text-sm text-destructive">
                Falha ao carregar o resumo do setor. Tente novamente.
              </p>
            )
          ) : (
            // Fora do setor Simples Nacional não tem resumo, mas a busca
            // continua disponível (qualquer setor pode consultar um cliente).
            <BuscarClienteContainer papel={sessao.papel} setor={sessao.setor} />
          )}
        </div>
      </main>
    </>
  );
}
