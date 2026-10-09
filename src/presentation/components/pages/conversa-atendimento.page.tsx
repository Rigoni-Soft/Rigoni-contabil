import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      voltar={
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
      }
      cabecalho={cabecalho}
      mensagens={mensagens}
      compositor={compositor}
      acoes={acoes}
      fila={fila}
    />
  );
}
