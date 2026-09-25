import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";

export type FiltroValues = {
  dataInicio?: string;
  dataFim?: string;
  setor?: string;
  ator?: string;
  acao?: string;
  alvo?: string;
  resultado?: "sucesso" | "falha" | "";
};

const SETORES = [
  "rh",
  "tributario",
  "simples_nacional",
  "contabil",
  "societario",
  "condominios",
  "financeiro",
  "administrativo",
  "contabil_externo",
  "ti",
  "recepcao",
] as const;

type AuditoriaFeedFiltroProps = {
  register: UseFormRegister<FiltroValues>;
  errors: FieldErrors<FiltroValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onLimpar: () => void;
};

export function AuditoriaFeedFiltro({
  register,
  errors,
  onSubmit,
  onLimpar,
}: AuditoriaFeedFiltroProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-lg border border-border bg-card p-4"
      noValidate
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataInicio">De</Label>
          <Input
            id="dataInicio"
            type="date"
            aria-invalid={!!errors.dataInicio}
            {...register("dataInicio")}
          />
          {errors.dataInicio && <FieldError>{errors.dataInicio.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataFim">Até</Label>
          <Input
            id="dataFim"
            type="date"
            aria-invalid={!!errors.dataFim}
            {...register("dataFim")}
          />
          {errors.dataFim && <FieldError>{errors.dataFim.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setor">Setor</Label>
          <Select id="setor" {...register("setor")}>
            <option value="">Todos</option>
            {SETORES.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resultado">Resultado</Label>
          <Select id="resultado" {...register("resultado")}>
            <option value="">Todos</option>
            <option value="sucesso">sucesso</option>
            <option value="falha">falha</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ator">Ator</Label>
          <Input id="ator" placeholder="id do usuário" {...register("ator")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acao">Ação</Label>
          <Input id="acao" placeholder="ex.: usuario.criar" {...register("acao")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alvo">Alvo</Label>
          <Input id="alvo" placeholder="busca parcial" {...register("alvo")} />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onLimpar}>
          Limpar
        </Button>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
