import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type HomePageProps = { header: React.ReactNode; nav: React.ReactNode; busca: React.ReactNode };

export function HomePage({ header, nav, busca }: HomePageProps) {
  return <TelaDeTrabalhoTemplate header={header} nav={nav} largura="conteudo" conteudo={busca} />;
}
