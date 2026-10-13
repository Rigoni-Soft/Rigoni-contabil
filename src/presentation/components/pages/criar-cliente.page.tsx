import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type CriarClientePageProps = { header: React.ReactNode; formulario: React.ReactNode };

export function CriarClientePage({ header, formulario }: CriarClientePageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="formulario"
      voltarHref="/"
      titulo="Cadastrar Cliente"
      conteudo={formulario}
    />
  );
}
