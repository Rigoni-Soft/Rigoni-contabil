import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type AuditoriaFeedPageProps = { header: React.ReactNode; feed: React.ReactNode };

export function AuditoriaFeedPage({ header, feed }: AuditoriaFeedPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conteudo"
      cabecalho={<CabecalhoDeTela voltarHref="/" titulo="Auditoria — feed bruto" />}
      conteudo={feed}
    />
  );
}
