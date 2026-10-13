import { AlertTriangle, Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
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
    <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
      <Pilha espaco="campo">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </Pilha>

      <Pilha espaco="campo">
        <Label htmlFor="senha">Senha</Label>
        <PasswordInput
          id="senha"
          autoComplete="current-password"
          aria-invalid={!!errors.senha}
          {...register("senha")}
        />
        {errors.senha && <FieldError>{errors.senha.message}</FieldError>}
      </Pilha>

      {erroServidor && (
        <Caixa className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <Texto variante="alerta" role="alert">
            {erroServidor}
          </Texto>
        </Caixa>
      )}

      <Button type="submit" disabled={pendente} className="w-full">
        {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </Pilha>
  );
}
