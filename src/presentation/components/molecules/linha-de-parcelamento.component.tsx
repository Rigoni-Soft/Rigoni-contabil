import { CheckCircle2, Clock, Trash2, type LucideIcon } from "lucide-react";

import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

export type SeloDoParcelamento = "quitado" | "enviado" | "pendente";

// Estado de resultado: ícone + texto + cor, nunca só cor (DESIGN.md "Indicadores de estado"). Enviado
// é `primary` (o dourado `success` é do selo "em dia" das telas de status do Simples Nacional);
// pendente e quitado ficam neutros, sem o vermelho de falha.
const SELO: Record<SeloDoParcelamento, { rotulo: string; classes: string; Icone?: LucideIcon }> = {
  quitado: { rotulo: "Quitado", classes: "border-border text-muted-foreground" },
  enviado: {
    rotulo: "Enviado no mês",
    classes: "border-primary text-primary",
    Icone: CheckCircle2,
  },
  pendente: {
    rotulo: "Pendente no mês",
    classes: "border-border bg-muted text-foreground",
    Icone: Clock,
  },
};

function SeloDeStatus({ idDoSelo, selo }: { idDoSelo: string; selo: SeloDoParcelamento }) {
  const { rotulo, classes, Icone } = SELO[selo];
  return (
    <Texto
      variante="nota"
      como="span"
      id={idDoSelo}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        classes,
      )}
    >
      {Icone && <Icone className="size-3" aria-hidden="true" />}
      {rotulo}
    </Texto>
  );
}

type LinhaDeParcelamentoProps = {
  indice: number;
  // Props dos inputs (o `register` do formulário, já resolvido por quem monta).
  codigo: React.ComponentProps<"input">;
  parcelas: React.ComponentProps<"input">;
  interno: React.ComponentProps<"input">;
  erroCodigo?: string;
  erroParcelas?: string;
  // Ausente na linha ainda não salva: o status do mês só existe para o Parcelamento gravado.
  selo?: SeloDoParcelamento;
  // Dica da caixa "É interno": para onde a guia vai.
  dicaInterno: string;
  // A dica só aparece à vista com a caixa marcada (a consequência que importa); o leitor de tela a ouve sempre.
  internoMarcado: boolean;
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
  internoMarcado,
  arquivo,
  desabilitado,
  onRemover,
  motivoSemRemover,
}: LinhaDeParcelamentoProps) {
  const idDoSelo = `parcelamentos.${indice}.selo`;
  const idDoMotivo = `parcelamentos.${indice}.motivo-remover`;
  return (
    <Pilha
      espaco={2}
      role="group"
      aria-label={`Parcelamento ${indice + 1}`}
      className="rounded-md border border-border p-3"
    >
      <Linha alinhar="fim" espaco={3} quebra>
        <CampoDeTexto
          id={`parcelamentos.${indice}.codigo`}
          rotulo="Código"
          obrigatorio={!desabilitado}
          maxLength={60}
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
          obrigatorio={!desabilitado}
          erro={erroParcelas}
          disabled={desabilitado}
          className="min-w-[8rem] flex-1 gap-1"
          {...parcelas}
        />
        <CaixaDeMarcacao
          rotulo="É interno"
          className="pb-2 pointer-coarse:min-h-11"
          disabled={desabilitado}
          aria-describedby={`parcelamentos.${indice}.interno-dica`}
          {...interno}
        />
        {/* Estado e ação juntos: no celular ocupam a linha toda (selo à esquerda, lixeira ao alcance do
            polegar, à direita); a partir de sm ficam à direita dos campos. */}
        <Linha
          alinhar="centro"
          justificar="entre"
          espaco={3}
          className="w-full sm:ml-auto sm:w-auto"
        >
          {selo ? <SeloDeStatus idDoSelo={idDoSelo} selo={selo} /> : <Caixa />}
          {(onRemover || motivoSemRemover) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              // aria-disabled, não disabled: o botão segue focável e o leitor de tela ouve o motivo.
              onClick={motivoSemRemover ? undefined : onRemover}
              aria-disabled={motivoSemRemover ? true : undefined}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-label={`Remover parcelamento ${indice + 1}`}
              aria-describedby={motivoSemRemover ? idDoMotivo : undefined}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </Linha>
      </Linha>
      <Texto
        variante="nota"
        id={`parcelamentos.${indice}.interno-dica`}
        className={internoMarcado ? undefined : "sr-only"}
      >
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
