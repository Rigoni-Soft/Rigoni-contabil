import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoSetorSnListaPageProps = {
  header: React.ReactNode;
  titulo: string;
  descricao?: string;
  lista: React.ReactNode;
};

export function ResumoSetorSnListaPage({
  header,
  titulo,
  descricao,
  lista,
}: ResumoSetorSnListaPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conteudo"
      cabecalho={
        <CabecalhoDeTela
          voltarHref="/simples-nacional"
          voltarRotulo="Voltar ao resumo"
          titulo={titulo}
          descricao={descricao}
        />
      }
      conteudo={lista}
    />
  );
}
