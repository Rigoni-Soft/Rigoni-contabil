import { AlertTriangle, Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { PasswordInput } from "@/presentation/components/ui/password-input";

type LoginFormValues = { email: string; senha: string };

type LoginFormProps = {
  register: UseFormRegister<LoginFormValues>;
  errors: FieldErrors<LoginFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
};

export function LoginForm({ register, errors, onSubmit, pendente, erroServidor }: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha</Label>
        <PasswordInput
          id="senha"
          autoComplete="current-password"
          aria-invalid={!!errors.senha}
          {...register("senha")}
        />
        {errors.senha && <FieldError>{errors.senha.message}</FieldError>}
      </div>

      {erroServidor && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p role="alert" className="text-sm text-destructive">
            {erroServidor}
          </p>
        </div>
      )}

      <Button type="submit" disabled={pendente} className="w-full">
        {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
