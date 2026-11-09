import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";

type ObservacoesDoRhProps = {
  valor: string;
  onMudar: (valor: string) => void;
  onSalvar: () => void;
  pendente: boolean;
  erro?: string;
  sucesso?: boolean;
};

// As observações gerais do RH na tela completa do Admin, que vê o SN e o RH: salvam à parte, sem tocar
// nos dados do SN.
export function ObservacoesDoRh({
  valor,
  onMudar,
  onSalvar,
  pendente,
  erro,
  sucesso,
}: ObservacoesDoRhProps) {
  return (
    <Pilha espaco={3} como="section" aria-labelledby="observacoes-do-rh">
      <Texto variante="subtitulo" como="h2" id="observacoes-do-rh">
        RH
      </Texto>
      <Pilha espaco={1}>
        <Label htmlFor="observacoes-do-rh-campo">Observações gerais do RH</Label>
        <Textarea
          id="observacoes-do-rh-campo"
          rows={3}
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
        />
      </Pilha>
      <Button type="button" onClick={onSalvar} disabled={pendente} className="self-start">
        Salvar observações do RH
      </Button>
      {erro && <FieldError>{erro}</FieldError>}
      {sucesso && <AvisoDeStatus tipo="sucesso" texto="Observações do RH atualizadas." />}
    </Pilha>
  );
}
