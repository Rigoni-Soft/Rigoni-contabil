import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { CabecalhoDeTela } from "@/presentation/components/molecules/cabecalho-de-tela.component";
import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";

type ResumoSetorSnListaPageProps = {
  header: React.ReactNode;
  titulo: string;
  descricao?: string;
  // Sem lista (falha de leitura) a tela mostra o `erro`.
  lista?: React.ReactNode;
  erro?: string;
  // A própria rota: com o `erro`, a tela oferece recarregá-la.
  tentarNovamenteHref?: string;
  // O resumo do Setor de onde a lista saiu.
  voltarHref?: string;
};

export function ResumoSetorSnListaPage({
  header,
  titulo,
  descricao,
  lista,
  erro,
  tentarNovamenteHref,
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
      conteudo={
        erro ? (
          <Pilha espaco={3}>
            <AvisoDeStatus tipo="erro" texto={erro} legivel />
            {tentarNovamenteHref && (
              <LinkDeAcao href={tentarNovamenteHref}>Tentar novamente</LinkDeAcao>
            )}
          </Pilha>
        ) : (
          lista
        )
      }
    />
  );
}
