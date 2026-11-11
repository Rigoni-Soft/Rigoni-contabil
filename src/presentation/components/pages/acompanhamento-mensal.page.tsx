import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type AcompanhamentoMensalPageProps = {
  header: React.ReactNode;
  // Sem nav, a tela de formulário segue o desenho da edição do cadastro operacional.
  nav?: React.ReactNode;
  titulo: string;
  voltarHref: string;
  // "cadastro" para tela de formulário (mesma largura da edição do cadastro operacional).
  largura?: "conteudo" | "cadastro";
  conteudo?: React.ReactNode;
  erro?: string;
  tentarNovamenteHref?: string;
};

export function AcompanhamentoMensalPage({
  header,
  nav,
  titulo,
  voltarHref,
  largura = "conteudo",
  conteudo,
  erro,
  tentarNovamenteHref,
}: AcompanhamentoMensalPageProps) {
  return (
    <TelaDeTrabalhoTemplate
      header={header}
      nav={nav}
      largura={largura}
      cabecalho={<CabecalhoDeTela voltarHref={voltarHref} titulo={titulo} />}
      conteudo={
        erro ? (
          <FalhaDeCarga texto={erro} tentarNovamenteHref={tentarNovamenteHref} />
        ) : (
          <Pilha espaco={largura === "cadastro" ? 6 : 8}>{conteudo}</Pilha>
        )
      }
    />
  );
}
