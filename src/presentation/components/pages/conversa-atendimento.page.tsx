import { LinkDeVoltar } from "@/presentation/components/atoms/link-de-voltar.component";
import { ConversaTemplate } from "@/presentation/components/templates/conversa-template.component";

type ConversaAtendimentoPageProps = {
  header: React.ReactNode;
  cabecalho: React.ReactNode;
  mensagens: React.ReactNode;
  compositor: React.ReactNode;
  acoes?: React.ReactNode;
  fila?: React.ReactNode;
};

// O template da conversa preenchido: os slots recebem os Containers montados em `app/`.
export function ConversaAtendimentoPage({
  header,
  cabecalho,
  mensagens,
  compositor,
  acoes,
  fila,
}: ConversaAtendimentoPageProps) {
  return (
    <ConversaTemplate
      header={header}
      voltar={<LinkDeVoltar href="/" />}
      cabecalho={cabecalho}
      mensagens={mensagens}
      compositor={compositor}
      acoes={acoes}
      fila={fila}
    />
  );
}
