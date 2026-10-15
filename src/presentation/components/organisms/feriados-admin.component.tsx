import { Loader2, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { formatarDataIso } from "@/shared/kernel/data-iso";

type FeriadoFormValues = { data: string; descricao: string };

type FeriadosAdminProps = {
  feriados: { data: string; descricao: string }[];
  register: UseFormRegister<FeriadoFormValues>;
  errors: FieldErrors<FeriadoFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onRemover: (data: string) => void;
  pendente: boolean;
  erroServidor?: string;
};

export function FeriadosAdmin({
  feriados,
  register,
  errors,
  onSubmit,
  onRemover,
  pendente,
  erroServidor,
}: FeriadosAdminProps) {
  return (
    <Caixa className="flex flex-col gap-8">
      <Texto variante="apoio">
        Os feriados nacionais já são reconhecidos. Cadastre aqui os estaduais e municipais: nesses
        dias o escritório conta como fechado para a URA.
      </Texto>

      <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
        <Grade colunas="1>rotulo-valor" espaco={5}>
          <Pilha espaco="campo">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" aria-invalid={!!errors.data} {...register("data")} />
            {errors.data && <FieldError>{errors.data.message}</FieldError>}
          </Pilha>
          <Pilha espaco="campo">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" aria-invalid={!!errors.descricao} {...register("descricao")} />
            {errors.descricao && <FieldError>{errors.descricao.message}</FieldError>}
          </Pilha>
        </Grade>
        {erroServidor && (
          <Texto variante="alerta" role="alert">
            {erroServidor}
          </Texto>
        )}
        <Button type="submit" disabled={pendente} className="self-start">
          {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
          Cadastrar feriado
        </Button>
      </Pilha>

      {feriados.length === 0 ? (
        <Texto variante="apoio">Nenhum feriado estadual ou municipal cadastrado.</Texto>
      ) : (
        <Caixa como="ul" className="divide-y divide-border rounded-lg border border-border bg-card">
          {feriados.map((feriado) => (
            <Linha
              alinhar="centro"
              justificar="entre"
              espaco={3}
              como="li"
              key={feriado.data}
              className="px-4 py-3"
            >
              <Texto como="span" variante="corpo">
                <Texto variante="enfase" como="strong">
                  {formatarDataIso(feriado.data)}
                </Texto>{" "}
                — {feriado.descricao}
              </Texto>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendente}
                aria-label={`Remover feriado de ${formatarDataIso(feriado.data)}`}
                onClick={() => onRemover(feriado.data)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </Linha>
          ))}
        </Caixa>
      )}
    </Caixa>
  );
}
