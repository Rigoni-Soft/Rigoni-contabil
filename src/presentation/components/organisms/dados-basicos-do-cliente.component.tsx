import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Props = { empresa: string; cnpj: string; regime: string };

// O que um Setor sem acesso ao cadastro do Cliente enxerga dele: só os dados básicos. Lista de
// definição, para o leitor de tela associar cada rótulo ao valor.
export function DadosBasicosDoCliente({ empresa, cnpj, regime }: Props) {
  const itens = [
    ["Empresa", empresa],
    ["CNPJ", formatarCnpj(cnpj)],
    ["Regime", regime],
  ] as const;
  return (
    <Pilha espaco={3} como="dl" aria-label="Dados básicos do cliente">
      {itens.map(([rotulo, valor]) => (
        <Caixa key={rotulo}>
          <Texto como="dt" variante="rotulo">
            {rotulo}
          </Texto>
          <Texto como="dd" variante="corpo">
            {valor}
          </Texto>
        </Caixa>
      ))}
    </Pilha>
  );
}
