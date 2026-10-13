import Link from "next/link";
import { Check, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { FileInput } from "@/presentation/components/atoms/file-input.component";
import { RequiredMark } from "@/presentation/components/atoms/required-mark.component";
import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { cn } from "@/presentation/lib/utils";
import { REGIME_LABEL, REGIMES } from "@/shared/kernel/regimes";

// PDF ou DOCX (ponto 2 do feedback manual, 2026-09-29) — dica do navegador;
// a validação de verdade fica no schema Zod (não confia só no `accept`).
const ACCEPT_DOCUMENTO =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type CriarClienteFormValues = {
  empresa: string;
  cnpj: string;
  regime: (typeof REGIMES)[number];
  contratoSocial?: File;
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
  // CNPJ→autopreenchimento de Empresa/Regime via API pública (ponto 4 do
  // feedback manual, 2026-09-29) — a consulta em si mora no Container.
  onCnpjBlur: (cnpjMascarado: string) => void;
  // Avisos da consulta de CNPJ (não são erro de validação — o Zod não sabe
  // se um CNPJ bem formado existe de verdade — por isso ficam fora de `errors`).
  avisoCnpj?: string;
  avisoRegime?: string;
  onRegimeChange: () => void;
  onEmpresaChange: () => void;
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
  onCnpjBlur,
  avisoCnpj,
  avisoRegime,
  onRegimeChange,
  onEmpresaChange,
}: CriarClienteFormProps) {
  if (criado) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
      <p className="text-xs text-muted-foreground">
        Campos com <span className="text-destructive">*</span> são obrigatórios.
      </p>

      {/* CNPJ primeiro (ponto 4 do feedback manual): autopreenche Empresa/Regime
          ao perder o foco, antes do resto do formulário ser preenchido à mão.
          3 colunas aproveita a largura do formulário (80% da tela, #36) em vez
          de empilhar os 3 campos de identificação numa coluna só. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj">
            CNPJ
            <RequiredMark />
          </Label>
          <Controller
            control={control}
            name="cnpj"
            render={({ field: { onChange, onBlur, value, name } }) => (
              <Input
                id="cnpj"
                name={name}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                maxLength={18}
                value={value ?? ""}
                aria-required="true"
                aria-invalid={!!errors.cnpj}
                onChange={(evento) => onChange(formatarCnpj(evento.target.value))}
                onBlur={(evento) => {
                  onBlur();
                  onCnpjBlur(evento.target.value);
                }}
              />
            )}
          />
          {errors.cnpj && <FieldError>{errors.cnpj.message}</FieldError>}
          {!errors.cnpj && avisoCnpj && <FieldError>{avisoCnpj}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="empresa">
            Empresa
            <RequiredMark />
          </Label>
          <Input
            id="empresa"
            aria-required="true"
            aria-invalid={!!errors.empresa}
            {...register("empresa", { onChange: onEmpresaChange })}
          />
          {errors.empresa && <FieldError>{errors.empresa.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="regime">
            Regime
            <RequiredMark />
          </Label>
          <Select
            id="regime"
            aria-required="true"
            aria-invalid={!!errors.regime}
            defaultValue=""
            {...register("regime", { onChange: onRegimeChange })}
          >
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
          {!errors.regime && avisoRegime && <FieldError>{avisoRegime}</FieldError>}
        </div>
      </div>

      {/* Seção de documentos separada da identificação do Cliente — mais espaço
          acima do heading que abaixo, mesma cadência de arquitetura.md/DESIGN.md. */}
      <div className="mt-2 flex flex-col gap-5 border-t border-border pt-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Documentos
        </h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contratoSocial">Contrato social</Label>
          <Controller
            control={control}
            name="contratoSocial"
            render={({ field: { onChange, onBlur, name, value } }) => (
              <FileInput
                id="contratoSocial"
                name={name}
                accept={ACCEPT_DOCUMENTO}
                file={value}
                onBlur={onBlur}
                aria-invalid={!!errors.contratoSocial}
                onChange={onChange}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
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
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`alteracoesContratuais.${indice}.arquivo`}
                  >{`Arquivo da alteração ${indice + 1}`}</Label>
                  <Controller
                    control={control}
                    name={`alteracoesContratuais.${indice}.arquivo` as const}
                    render={({ field: { onChange, onBlur, name, value } }) => (
                      <FileInput
                        id={`alteracoesContratuais.${indice}.arquivo`}
                        name={name}
                        accept={ACCEPT_DOCUMENTO}
                        file={value}
                        onBlur={onBlur}
                        aria-invalid={!!errors.alteracoesContratuais?.[indice]?.arquivo}
                        onChange={onChange}
                      />
                    )}
                  />
                  {errors.alteracoesContratuais?.[indice]?.arquivo && (
                    <FieldError>
                      {errors.alteracoesContratuais[indice]?.arquivo?.message}
                    </FieldError>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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
