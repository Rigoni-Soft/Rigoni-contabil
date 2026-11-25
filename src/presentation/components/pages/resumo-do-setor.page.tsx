import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoDoSetorPageProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  resumo?: React.ReactNode;
  comparativos?: React.ReactNode;
  acoes?: React.ReactNode;
  erro?: string;
  tentarNovamenteHref?: string;
};

export function ResumoDoSetorPage({
  header,
  nav,
  resumo,
  comparativos,
  acoes,
  erro,
  tentarNovamenteHref,
}: ResumoDoSetorPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      conteudo={
        erro ? (
          <FalhaDeCarga texto={erro} tentarNovamenteHref={tentarNovamenteHref} />
        ) : (
          <Pilha espaco={8}>
            {acoes}
            {resumo}
            {comparativos}
          </Pilha>
        )
      }
    />
  );
}
