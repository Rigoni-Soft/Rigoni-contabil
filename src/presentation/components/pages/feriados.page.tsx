import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type FeriadosPageProps = { header: React.ReactNode; conteudo: React.ReactNode };

export function FeriadosPage({ header, conteudo }: FeriadosPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="formulario"
      voltarHref="/"
      titulo="Feriados estaduais e municipais"
      conteudo={conteudo}
    />
  );
}
