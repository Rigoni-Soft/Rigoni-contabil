import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { SETOR_LABEL, SETORES } from "@/shared/kernel/setores";

export type FiltroValues = {
  dataInicio?: string;
  dataFim?: string;
  setor?: string;
  ator?: string;
  acao?: string;
  alvo?: string;
  resultado?: "sucesso" | "falha" | "falha_compensacao" | "";
};

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
    <Caixa
      como="form"
      onSubmit={onSubmit}
      className="mb-6 rounded-lg border border-border bg-card p-4"
      noValidate
    >
      <Grade colunas="2>4" className="gap-x-3 gap-y-4">
        <Pilha espaco="campo">
          <Label htmlFor="dataInicio">De</Label>
          <Input
            id="dataInicio"
            type="date"
            aria-invalid={!!errors.dataInicio}
            {...register("dataInicio")}
          />
          {errors.dataInicio && <FieldError>{errors.dataInicio.message}</FieldError>}
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="dataFim">Até</Label>
          <Input
            id="dataFim"
            type="date"
            aria-invalid={!!errors.dataFim}
            {...register("dataFim")}
          />
          {errors.dataFim && <FieldError>{errors.dataFim.message}</FieldError>}
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="setor">Setor</Label>
          <Select id="setor" {...register("setor")}>
            <Opcao value="">Todos</Opcao>
            {SETORES.map((setor) => (
              <Opcao key={setor} value={setor}>
                {SETOR_LABEL[setor]}
              </Opcao>
            ))}
          </Select>
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="resultado">Resultado</Label>
          <Select id="resultado" {...register("resultado")}>
            <Opcao value="">Todos</Opcao>
            <Opcao value="sucesso">sucesso</Opcao>
            <Opcao value="falha">falha</Opcao>
            <Opcao value="falha_compensacao">falha_compensacao</Opcao>
          </Select>
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="ator">Ator</Label>
          <Input
            id="ator"
            placeholder="id do usuário"
            aria-invalid={!!errors.ator}
            {...register("ator")}
          />
          {errors.ator && <FieldError>{errors.ator.message}</FieldError>}
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="acao">Ação</Label>
          <Input id="acao" placeholder="ex.: usuario.criar" {...register("acao")} />
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor="alvo">Alvo</Label>
          <Input id="alvo" placeholder="busca parcial" {...register("alvo")} />
        </Pilha>
      </Grade>

      <Linha justificar="fim" espaco={2} className="mt-4 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onLimpar}>
          Limpar
        </Button>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </Linha>
    </Caixa>
  );
}
