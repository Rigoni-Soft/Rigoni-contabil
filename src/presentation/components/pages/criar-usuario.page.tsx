import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type CriarUsuarioPageProps = { header: React.ReactNode; formulario: React.ReactNode };

export function CriarUsuarioPage({ header, formulario }: CriarUsuarioPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="formulario"
      cabecalho={<CabecalhoDeTela voltarHref="/" titulo="Cadastrar Líder ou Funcionário" />}
      conteudo={formulario}
    />
  );
}
