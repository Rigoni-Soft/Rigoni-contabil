import { Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { SETORES } from "@/shared/kernel/setores";

export type CriarUsuarioFormValues = {
  nome: string;
  email: string;
  papel: "lider_setor" | "funcionario";
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
};

export function CriarUsuarioForm({
  register,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  criado,
}: CriarUsuarioFormProps) {
  if (criado) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground">
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
        <select
          id="papel"
          aria-invalid={!!errors.papel}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          defaultValue=""
          {...register("papel")}
        >
          <option value="" disabled>
            Selecione
          </option>
          <option value="lider_setor">Líder de setor</option>
          <option value="funcionario">Funcionário</option>
        </select>
        {errors.papel && <FieldError>{errors.papel.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setor">Setor</Label>
        <select
          id="setor"
          aria-invalid={!!errors.setor}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          defaultValue=""
          {...register("setor")}
        >
          <option value="" disabled>
            Selecione
          </option>
          {SETORES.map((setor) => (
            <option key={setor} value={setor}>
              {setor}
            </option>
          ))}
        </select>
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
