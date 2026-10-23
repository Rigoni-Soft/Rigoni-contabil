import { Trash2 } from "lucide-react";

import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import {
  SeloDeParcelamento,
  type SeloDoParcelamento,
} from "@/presentation/components/molecules/selo-do-parcelamento.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

const DICA_INTERNO = "Marcado: a guia vai ao WhatsApp do financeiro, não ao Cliente.";
const MOTIVO_SEM_REMOVER = "Já teve guia enviada: não pode ser removido.";

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
  // Nome do PDF já gravado; no Parcelamento novo, o campo de arquivo (controlado pelo formulário).
  arquivo: React.ReactNode;
  // Quitado não se edita: os campos ficam desabilitados.
  desabilitado?: boolean;
  // Sem callback (visualização): o botão nem aparece. Com envio registrado, aparece bloqueado.
  onRemover?: () => void;
  bloqueadoPorEnvio?: boolean;
  // Visualização: nada é obrigatório (não há o que preencher), então sem asterisco.
  somenteLeitura?: boolean;
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
  arquivo,
  desabilitado,
  onRemover,
  bloqueadoPorEnvio,
  somenteLeitura,
}: LinhaDeParcelamentoProps) {
  const idDoMotivo = `parcelamentos.${indice}.motivo-remover`;
  return (
    <Pilha
      espaco={2}
      role="group"
      aria-label={`Parcelamento ${indice + 1}`}
      className="group/linha rounded-md border border-border p-3"
    >
      <Linha alinhar="fim" espaco={3} quebra>
        <CampoDeTexto
          id={`parcelamentos.${indice}.codigo`}
          rotulo="Código"
          placeholder="Gerado pelo sistema"
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
          obrigatorio={!desabilitado && !somenteLeitura}
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
          className={cn("w-full sm:ml-auto sm:w-auto", !selo && "justify-end")}
        >
          {selo && <SeloDeParcelamento selo={selo} />}
          {(onRemover || bloqueadoPorEnvio) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              // aria-disabled, não disabled: o botão segue focável e o leitor de tela ouve o motivo.
              onClick={bloqueadoPorEnvio ? undefined : onRemover}
              aria-disabled={bloqueadoPorEnvio || undefined}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-label={`Remover parcelamento ${indice + 1}`}
              aria-describedby={bloqueadoPorEnvio ? idDoMotivo : undefined}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </Linha>
      </Linha>
      <Texto
        variante="nota"
        id={`parcelamentos.${indice}.interno-dica`}
        // À vista só com a caixa marcada (a consequência que importa), por CSS: digitar na linha não
        // re-renderiza o formulário. O leitor de tela a ouve sempre.
        className="sr-only group-has-[:checked]/linha:not-sr-only"
      >
        {DICA_INTERNO}
      </Texto>
      {bloqueadoPorEnvio && (
        <Texto variante="nota" id={idDoMotivo}>
          {MOTIVO_SEM_REMOVER}
        </Texto>
      )}
      {arquivo}
    </Pilha>
  );
}
