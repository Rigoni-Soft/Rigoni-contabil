import { Trash2 } from "lucide-react";

import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

export type SeloDoParcelamento = "quitado" | "enviado" | "pendente";

const SELO: Record<SeloDoParcelamento, { rotulo: string; classes: string }> = {
  quitado: { rotulo: "Quitado", classes: "border border-border text-muted-foreground" },
  enviado: { rotulo: "Enviado no mês", classes: "bg-success text-success-foreground" },
  pendente: { rotulo: "Pendente no mês", classes: "border border-border bg-muted text-foreground" },
};

type LinhaDeParcelamentoProps = {
  indice: number;
  // Props dos inputs (o `register` do formulário, já resolvido por quem monta).
  codigo: React.ComponentProps<"input">;
  parcelas: React.ComponentProps<"input">;
  interno: React.ComponentProps<"input">;
  erroCodigo?: string;
  erroParcelas?: string;
  selo: SeloDoParcelamento;
  // Dica da caixa "É interno": para onde a guia vai.
  dicaInterno: string;
  // Nome do PDF já gravado; no Parcelamento novo, o campo de arquivo (controlado pelo formulário).
  arquivo: React.ReactNode;
  // Quitado não se edita: os campos ficam desabilitados.
  desabilitado?: boolean;
  // Sem callback (visualização): o botão nem aparece. Com `motivoSemRemover`, aparece desabilitado.
  onRemover?: () => void;
  motivoSemRemover?: string;
};

// Um Parcelamento do Cliente: código, parcelas restantes, "É interno", selo do mês e remover, com o
// PDF anexado abaixo. A numeração é 1-based.
export function LinhaDeParcelamento({
  indice,
  codigo,
  parcelas,
  interno,
  erroCodigo,
  erroParcelas,
  selo,
  dicaInterno,
  arquivo,
  desabilitado,
  onRemover,
  motivoSemRemover,
}: LinhaDeParcelamentoProps) {
  const idDoSelo = `parcelamentos.${indice}.selo`;
  const idDoMotivo = `parcelamentos.${indice}.motivo-remover`;
  return (
    <Pilha espaco={2} className="rounded-md border border-border p-3">
      <Linha alinhar="fim" espaco={3} quebra>
        <CampoDeTexto
          id={`parcelamentos.${indice}.codigo`}
          rotulo="Código"
          obrigatorio
          erro={erroCodigo}
          disabled={desabilitado}
          className="min-w-[10rem] flex-1 gap-1"
          {...codigo}
        />
        <CampoDeTexto
          id={`parcelamentos.${indice}.parcelasRestantes`}
          rotulo="Parcelas restantes"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          obrigatorio
          erro={erroParcelas}
          disabled={desabilitado}
          className="min-w-[8rem] flex-1 gap-1"
          {...parcelas}
        />
        <CaixaDeMarcacao
          rotulo="É interno"
          className="pb-2"
          disabled={desabilitado}
          aria-describedby={`parcelamentos.${indice}.interno-dica`}
          {...interno}
        />
        <Texto
          variante="nota"
          como="span"
          id={idDoSelo}
          className={cn("mb-2 rounded-full px-2 py-0.5 font-medium", SELO[selo].classes)}
        >
          {SELO[selo].rotulo}
        </Texto>
        {(onRemover || motivoSemRemover) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemover}
            disabled={!!motivoSemRemover}
            aria-label={`Remover parcelamento ${indice + 1}`}
            aria-describedby={motivoSemRemover ? idDoMotivo : undefined}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </Linha>
      <Texto variante="nota" id={`parcelamentos.${indice}.interno-dica`}>
        {dicaInterno}
      </Texto>
      {motivoSemRemover && (
        <Texto variante="nota" id={idDoMotivo}>
          {motivoSemRemover}
        </Texto>
      )}
      {arquivo}
    </Pilha>
  );
}
