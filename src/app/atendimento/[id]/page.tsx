import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ConversaAtendimentoPage } from "@/presentation/components/pages/conversa-atendimento.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { ConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/conversa.container";
import { carregarConversa } from "@/modules/atendimento/presentation/view-models/conversa/conversa.server";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [sessao, conversa] = await Promise.all([carregarSessao(), carregarConversa(id)]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  // Sem permissão, inexistente ou id inválido: volta ao início, como as outras telas protegidas.
  if (!conversa.ok) redirect("/");

  return (
    <ConversaAtendimentoPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      conversa={<ConversaContainer atendimentoId={id} initialData={conversa.value} />}
    />
  );
}
