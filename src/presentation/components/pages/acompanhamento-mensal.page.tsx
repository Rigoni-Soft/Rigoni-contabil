import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type AcompanhamentoMensalPageProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  titulo: string;
  voltarHref: string;
  conteudo?: React.ReactNode;
  erro?: string;
  tentarNovamenteHref?: string;
};

export function AcompanhamentoMensalPage({
  header,
  nav,
  titulo,
  voltarHref,
  conteudo,
  erro,
  tentarNovamenteHref,
}: AcompanhamentoMensalPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura="conteudo"
      cabecalho={<CabecalhoDeTela voltarHref={voltarHref} titulo={titulo} />}
      conteudo={
        erro ? (
          <FalhaDeCarga texto={erro} tentarNovamenteHref={tentarNovamenteHref} />
        ) : (
          <Pilha espaco={8}>{conteudo}</Pilha>
        )
      }
    />
  );
}
