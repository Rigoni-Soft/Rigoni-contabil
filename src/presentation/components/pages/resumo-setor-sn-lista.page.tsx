import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type Props = { header: React.ReactNode; titulo: string; lista: React.ReactNode };

export function ResumoSetorSnListaPage({ header, titulo, lista }: Props) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conteudo"
      voltarHref="/simples-nacional"
      voltarRotulo="Voltar ao resumo"
      titulo={titulo}
      conteudo={lista}
    />
  );
}
