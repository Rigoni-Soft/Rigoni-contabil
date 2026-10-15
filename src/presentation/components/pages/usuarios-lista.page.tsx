import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type UsuariosListaPageProps = { header: React.ReactNode; lista: React.ReactNode };

export function UsuariosListaPage({ header, lista }: UsuariosListaPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="lista"
      cabecalho={<CabecalhoDeTela voltarHref="/" titulo="Usuários" />}
      conteudo={lista}
    />
  );
}
