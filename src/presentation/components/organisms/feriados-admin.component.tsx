import { Loader2, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
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
      <Texto variante="livre" className="text-sm text-muted-foreground">
        Os feriados nacionais já são reconhecidos. Cadastre aqui os estaduais e municipais: nesses
        dias o escritório conta como fechado para a URA.
      </Texto>

      <Caixa como="form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Caixa className="grid grid-cols-1 gap-5 sm:grid-cols-[12rem_1fr]">
          <Caixa className="flex flex-col gap-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" aria-invalid={!!errors.data} {...register("data")} />
            {errors.data && <FieldError>{errors.data.message}</FieldError>}
          </Caixa>
          <Caixa className="flex flex-col gap-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" aria-invalid={!!errors.descricao} {...register("descricao")} />
            {errors.descricao && <FieldError>{errors.descricao.message}</FieldError>}
          </Caixa>
        </Caixa>
        {erroServidor && (
          <Texto variante="livre" role="alert" className="text-sm text-destructive">
            {erroServidor}
          </Texto>
        )}
        <Button type="submit" disabled={pendente} className="self-start">
          {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
          Cadastrar feriado
        </Button>
      </Caixa>

      {feriados.length === 0 ? (
        <Texto variante="livre" className="text-sm text-muted-foreground">
          Nenhum feriado estadual ou municipal cadastrado.
        </Texto>
      ) : (
        <Caixa como="ul" className="divide-y divide-border rounded-lg border border-border bg-card">
          {feriados.map((feriado) => (
            <Caixa
              como="li"
              key={feriado.data}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <Texto variante="livre" como="span" className="text-sm">
                <Texto variante="livre" como="strong">
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
            </Caixa>
          ))}
        </Caixa>
      )}
    </Caixa>
  );
}
