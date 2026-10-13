import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type UsuariosListaPageProps = { header: React.ReactNode; lista: React.ReactNode };

export function UsuariosListaPage({ header, lista }: UsuariosListaPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="lista"
      voltarHref="/"
      titulo="Usuários"
      conteudo={lista}
    />
  );
}
