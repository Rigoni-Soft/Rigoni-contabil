import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { REGIME_LABEL } from "@/shared/kernel/regimes";

export type CabecalhoCliente = { empresa: string; cnpj: string; regime?: string };

type CabecalhoDoCadastroProps = {
  cabecalho: CabecalhoCliente;
  children?: React.ReactNode;
  documentoContratual?: React.ReactNode;
};

export function CabecalhoDoCadastro({
  cabecalho,
  children,
  documentoContratual,
}: CabecalhoDoCadastroProps) {
  return (
    <Pilha espaco={4}>
      <Grade colunas="1>2>cabecalho" espaco={4}>
        <Pilha espaco={1}>
          <Label htmlFor="cabecalho-empresa">Empresa</Label>
          <Input
            id="cabecalho-empresa"
            value={cabecalho.empresa}
            title={cabecalho.empresa}
            disabled
            readOnly
          />
        </Pilha>
        <Pilha espaco={1}>
          <Label htmlFor="cabecalho-cnpj">CNPJ</Label>
          <Input id="cabecalho-cnpj" value={cabecalho.cnpj} disabled readOnly />
        </Pilha>
        {cabecalho.regime && (
          <Pilha espaco={1}>
            <Label htmlFor="cabecalho-regime">Regime</Label>
            <Input
              id="cabecalho-regime"
              value={REGIME_LABEL[cabecalho.regime] ?? cabecalho.regime}
              disabled
              readOnly
            />
          </Pilha>
        )}
        {children}
      </Grade>

      {documentoContratual}
    </Pilha>
  );
}
