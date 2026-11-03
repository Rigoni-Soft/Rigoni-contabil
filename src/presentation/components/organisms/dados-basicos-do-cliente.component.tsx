import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Props = { empresa: string; cnpj: string; regime: string };

// O que um Setor sem acesso ao cadastro do Cliente enxerga dele: só os dados básicos.
export function DadosBasicosDoCliente({ empresa, cnpj, regime }: Props) {
  return (
    <Pilha espaco={3} como="section" aria-label="Dados básicos do cliente">
      <Caixa>
        <Texto variante="rotulo">Empresa</Texto>
        <Texto variante="corpo">{empresa}</Texto>
      </Caixa>
      <Caixa>
        <Texto variante="rotulo">CNPJ</Texto>
        <Texto variante="corpo">{formatarCnpj(cnpj)}</Texto>
      </Caixa>
      <Caixa>
        <Texto variante="rotulo">Regime</Texto>
        <Texto variante="corpo">{regime}</Texto>
      </Caixa>
    </Pilha>
  );
}
