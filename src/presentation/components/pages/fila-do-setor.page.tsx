import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type FilaDoSetorPageProps = { header: React.ReactNode; fila: React.ReactNode };

export function FilaDoSetorPage({ header, fila }: FilaDoSetorPageProps) {
  return <TelaDeTrabalhoTemplate header={header} largura="lista" voltarHref="/" conteudo={fila} />;
}
