import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ConversaAtendimentoPage } from "@/presentation/components/pages/conversa-atendimento.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { AcoesConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/acoes-conversa.container";
import { CabecalhoConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/cabecalho-conversa.container";
import { CompositorConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/compositor-conversa.container";
import { carregarConversa } from "@/modules/atendimento/presentation/view-models/conversa/conversa.server";
import { MensagensConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/mensagens-conversa.container";
import { FilaContainer } from "@/modules/atendimento/presentation/view-models/fila/fila.container";
import { carregarFilaDoProprioSetor } from "@/modules/atendimento/presentation/view-models/fila/fila.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [sessao, conversa] = await Promise.all([carregarSessao(), carregarConversa(id)]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  // Sem permissão, inexistente ou id inválido: volta ao início, como as outras telas protegidas.
  if (!conversa.ok) redirect("/");

  const fila = await carregarFilaDoProprioSetor(sessao);

  return (
    <ConversaAtendimentoPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer papel={sessao.papel} />}
        />
      }
      fila={
        fila && (
          <FilaContainer
            nome={sessao.nome}
            setorInicial={fila.setor}
            initialData={fila.dados}
            podeEscolherSetor={false}
          />
        )
      }
      cabecalho={<CabecalhoConversaContainer atendimentoId={id} initialData={conversa.value} />}
      mensagens={<MensagensConversaContainer atendimentoId={id} initialData={conversa.value} />}
      compositor={<CompositorConversaContainer atendimentoId={id} initialData={conversa.value} />}
      // Encerrado desde o carregamento: sem painel, o chat ocupa a largura toda.
      acoes={
        conversa.value.encerrado ? undefined : (
          <AcoesConversaContainer atendimentoId={id} initialData={conversa.value} />
        )
      }
    />
  );
}
