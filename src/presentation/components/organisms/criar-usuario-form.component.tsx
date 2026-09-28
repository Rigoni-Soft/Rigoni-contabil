import { CheckCircle2, Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { PAPEL_LABEL, type PapelCadastravel } from "@/shared/kernel/papeis";

export type CriarUsuarioFormValues = {
  nome: string;
  email: string;
  papel: PapelCadastravel;
  setor: string;
};

type ContaCriada = { nome: string; email: string; senhaProvisoria: string };

type CriarUsuarioFormProps = {
  register: UseFormRegister<CriarUsuarioFormValues>;
  errors: FieldErrors<CriarUsuarioFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  criado?: ContaCriada;
  // Escopado por RBAC em quem monta a página (Admin vê tudo, Líder de setor só o
  // próprio Setor) — o formulário só reflete o que já é permitido, não decide.
  papeisDisponiveis: PapelCadastravel[];
  setoresDisponiveis: readonly string[];
};

export function CriarUsuarioForm({
  register,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  criado,
  papeisDisponiveis,
  setoresDisponiveis,
}: CriarUsuarioFormProps) {
  // Quando só há 1 opção possível (Líder de setor: só "funcionario" no próprio
  // Setor), não faz sentido pedir pra escolher — já vem selecionado e travado.
  const papelUnico = papeisDisponiveis.length === 1 ? papeisDisponiveis[0] : undefined;
  const setorUnico = setoresDisponiveis.length === 1 ? setoresDisponiveis[0] : undefined;

  if (criado) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Conta de <strong>{criado.nome}</strong> ({criado.email}) criada.
        </p>
        <p className="text-sm text-muted-foreground">
          Senha provisória — repasse com segurança, será exigida troca no primeiro acesso:
        </p>
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-lg tracking-wider">
          {criado.senhaProvisoria}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" aria-invalid={!!errors.nome} {...register("nome")} />
        {errors.nome && <FieldError>{errors.nome.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="papel">Papel</Label>
        <Select
          id="papel"
          aria-invalid={!!errors.papel}
          defaultValue={papelUnico ?? ""}
          disabled={!!papelUnico}
          {...register("papel")}
        >
          {!papelUnico && (
            <option value="" disabled>
              Selecione
            </option>
          )}
          {papeisDisponiveis.map((papel) => (
            <option key={papel} value={papel}>
              {PAPEL_LABEL[papel]}
            </option>
          ))}
        </Select>
        {errors.papel && <FieldError>{errors.papel.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setor">Setor</Label>
        <Select
          id="setor"
          aria-invalid={!!errors.setor}
          defaultValue={setorUnico ?? ""}
          disabled={!!setorUnico}
          {...register("setor")}
        >
          {!setorUnico && (
            <option value="" disabled>
              Selecione
            </option>
          )}
          {setoresDisponiveis.map((setor) => (
            <option key={setor} value={setor}>
              {setor}
            </option>
          ))}
        </Select>
        {errors.setor && <FieldError>{errors.setor.message}</FieldError>}
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
