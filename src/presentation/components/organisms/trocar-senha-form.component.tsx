import { AlertTriangle, Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { PasswordInput } from "@/presentation/components/ui/password-input";

type TrocarSenhaFormValues = { novaSenha: string; confirmacao: string };

type TrocarSenhaFormProps = {
  register: UseFormRegister<TrocarSenhaFormValues>;
  errors: FieldErrors<TrocarSenhaFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
};

export function TrocarSenhaForm({
  register,
  errors,
  onSubmit,
  pendente,
  erroServidor,
}: TrocarSenhaFormProps) {
  return (
    <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
      <Pilha espaco="campo">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <PasswordInput
          id="novaSenha"
          autoComplete="new-password"
          aria-invalid={!!errors.novaSenha}
          {...register("novaSenha")}
        />
        {errors.novaSenha && <FieldError>{errors.novaSenha.message}</FieldError>}
      </Pilha>

      <Pilha espaco="campo">
        <Label htmlFor="confirmacao">Confirmar nova senha</Label>
        <PasswordInput
          id="confirmacao"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmacao}
          {...register("confirmacao")}
        />
        {errors.confirmacao && <FieldError>{errors.confirmacao.message}</FieldError>}
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
        {pendente ? "Trocando…" : "Trocar senha"}
      </Button>
    </Pilha>
  );
}
