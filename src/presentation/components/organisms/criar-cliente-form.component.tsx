import Link from "next/link";
import { Check, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";
import { REGIME_LABEL, REGIMES } from "@/shared/kernel/regimes";

export type CriarClienteFormValues = {
  empresa: string;
  cnpj: string;
  regime: (typeof REGIMES)[number];
  contratoSocial: File;
  alteracoesContratuais: { data: string; arquivo: File }[];
};

type ClienteCriado = { empresa: string; cnpj: string };

type CriarClienteFormProps = {
  register: UseFormRegister<CriarClienteFormValues>;
  control: Control<CriarClienteFormValues>;
  errors: FieldErrors<CriarClienteFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  criado?: ClienteCriado;
  // Chamado ao clicar "Cadastrar outro" na tela de confirmação — mesmo padrão do
  // formulário de usuário (#30/#32).
  onCadastrarNovo: () => void;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  alteracoes: { id: string }[];
  onAdicionarAlteracao: () => void;
  onRemoverAlteracao: (indice: number) => void;
};

export function CriarClienteForm({
  register,
  control,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  criado,
  onCadastrarNovo,
  alteracoes,
  onAdicionarAlteracao,
  onRemoverAlteracao,
}: CriarClienteFormProps) {
  if (criado) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Cliente <strong>{criado.empresa}</strong> (CNPJ {criado.cnpj}) cadastrado.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={onCadastrarNovo} className="sm:flex-1">
            Cadastrar outro
          </Button>
          {/* Provisório: leva pra home, mesmo padrão do formulário de usuário (#30/#32). */}
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}>
            <Check aria-hidden="true" />
            Finalizar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empresa">Empresa</Label>
        <Input id="empresa" aria-invalid={!!errors.empresa} {...register("empresa")} />
        {errors.empresa && <FieldError>{errors.empresa.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" aria-invalid={!!errors.cnpj} {...register("cnpj")} />
        {errors.cnpj && <FieldError>{errors.cnpj.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="regime">Regime</Label>
        <Select id="regime" aria-invalid={!!errors.regime} defaultValue="" {...register("regime")}>
          <option value="" disabled>
            Selecione
          </option>
          {REGIMES.map((regime) => (
            <option key={regime} value={regime}>
              {REGIME_LABEL[regime]}
            </option>
          ))}
        </Select>
        {errors.regime && <FieldError>{errors.regime.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contratoSocial">Contrato social</Label>
        <Controller
          control={control}
          name="contratoSocial"
          render={({ field: { onChange, onBlur, name } }) => (
            <Input
              id="contratoSocial"
              type="file"
              name={name}
              onBlur={onBlur}
              aria-invalid={!!errors.contratoSocial}
              onChange={(evento) => onChange(evento.target.files?.[0])}
            />
          )}
        />
        {errors.contratoSocial && <FieldError>{errors.contratoSocial.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Alterações contratuais</Label>
          <Button type="button" variant="outline" size="sm" onClick={onAdicionarAlteracao}>
            <Plus aria-hidden="true" />
            Adicionar
          </Button>
        </div>

        {alteracoes.map((alteracao, indice) => (
          <div
            key={alteracao.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{`Alteração ${indice + 1}`}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover alteração ${indice + 1}`}
                onClick={() => onRemoverAlteracao(indice)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>

            <Label
              htmlFor={`alteracoesContratuais.${indice}.data`}
            >{`Data da alteração ${indice + 1}`}</Label>
            <Input
              id={`alteracoesContratuais.${indice}.data`}
              type="date"
              aria-invalid={!!errors.alteracoesContratuais?.[indice]?.data}
              {...register(`alteracoesContratuais.${indice}.data` as const)}
            />
            {errors.alteracoesContratuais?.[indice]?.data && (
              <FieldError>{errors.alteracoesContratuais[indice]?.data?.message}</FieldError>
            )}

            <Controller
              control={control}
              name={`alteracoesContratuais.${indice}.arquivo` as const}
              render={({ field: { onChange, onBlur, name } }) => (
                <Input
                  type="file"
                  name={name}
                  onBlur={onBlur}
                  aria-label={`Arquivo da alteração ${indice + 1}`}
                  aria-invalid={!!errors.alteracoesContratuais?.[indice]?.arquivo}
                  onChange={(evento) => onChange(evento.target.files?.[0])}
                />
              )}
            />
            {errors.alteracoesContratuais?.[indice]?.arquivo && (
              <FieldError>{errors.alteracoesContratuais[indice]?.arquivo?.message}</FieldError>
            )}
          </div>
        ))}
      </div>

      {erroServidor && (
        <p role="alert" className="text-sm text-destructive">
          {erroServidor}
        </p>
      )}

      <Button type="submit" disabled={pendente}>
        {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
        {pendente ? "Cadastrando…" : "Cadastrar"}
      </Button>
    </form>
  );
}
