import { notFound, redirect } from "next/navigation";

import { ResumoSetorSnLista } from "@/presentation/components/organisms/resumo-setor-sn-lista.component";
import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ResumoSetorSnListaPage } from "@/presentation/components/pages/resumo-setor-sn-lista.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { carregarResumoSetorSn } from "@/modules/clientes/presentation/view-models/resumo-setor-sn/resumo-setor-sn.server";
import { podeVerDashboardSn } from "@/shared/kernel/papeis";

type Props = { params: Promise<{ bucket: string }> };

export default async function Page({ params }: Props) {
  const { bucket } = await params;
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  // Resumo do setor é exclusivo do Simples Nacional — mesmo critério de acesso de app/page.tsx.
  if (!podeVerDashboardSn(sessao.papel, sessao.setor)) redirect("/");

  const resumo = await carregarResumoSetorSn();
  if (!resumo.ok) redirect("/");

  const card = resumo.value.cards.find((c) => c.id === bucket);
  if (!card) notFound();

  return (
    <ResumoSetorSnListaPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer papel={sessao.papel} />}
        />
      }
      titulo={card.titulo}
      lista={<ResumoSetorSnLista clientes={card.clientes} bucket={bucket} />}
    />
  );
}
