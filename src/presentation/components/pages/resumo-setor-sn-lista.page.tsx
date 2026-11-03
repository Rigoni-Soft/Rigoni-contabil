import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoSetorSnListaPageProps = {
  header: React.ReactNode;
  titulo: string;
  descricao?: string;
  lista: React.ReactNode;
  // O resumo do Setor de onde a lista saiu.
  voltarHref?: string;
};

export function ResumoSetorSnListaPage({
  header,
  titulo,
  descricao,
  lista,
  voltarHref = "/simples-nacional",
}: ResumoSetorSnListaPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conteudo"
      cabecalho={
        <CabecalhoDeTela
          voltarHref={voltarHref}
          voltarRotulo="Voltar ao resumo"
          titulo={titulo}
          descricao={descricao}
        />
      }
      conteudo={lista}
    />
  );
}
