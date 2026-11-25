import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoSetorListaPageProps = {
  header: React.ReactNode;
  titulo: string;
  descricao?: string;
  lista?: React.ReactNode;
  erro?: string;
  tentarNovamenteHref?: string;
  voltarHref: string;
};

export function ResumoSetorListaPage({
  header,
  titulo,
  descricao,
  lista,
  erro,
  tentarNovamenteHref,
  voltarHref,
}: ResumoSetorListaPageProps) {
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
      conteudo={
        erro ? <FalhaDeCarga texto={erro} tentarNovamenteHref={tentarNovamenteHref} /> : lista
      }
    />
  );
}
