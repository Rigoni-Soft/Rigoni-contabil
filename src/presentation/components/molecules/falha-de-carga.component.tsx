import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";

type FalhaDeCargaProps = {
  texto: string;
  // A própria rota: com ela, a tela oferece recarregá-la.
  tentarNovamenteHref?: string;
};

// Falha de leitura de uma tela: o aviso (lido por leitor de tela) e o caminho para tentar de novo.
export function FalhaDeCarga({ texto, tentarNovamenteHref }: FalhaDeCargaProps) {
  return (
    <Pilha espaco={3}>
      <AvisoDeStatus tipo="erro" texto={texto} legivel />
      {tentarNovamenteHref && <LinkDeAcao href={tentarNovamenteHref}>Tentar novamente</LinkDeAcao>}
    </Pilha>
  );
}
