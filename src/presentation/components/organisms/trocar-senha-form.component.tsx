import { AlertTriangle, Loader2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <Input
          id="novaSenha"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.novaSenha}
          {...register("novaSenha")}
        />
        {errors.novaSenha && <FieldError>{errors.novaSenha.message}</FieldError>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmacao">Confirmar nova senha</Label>
        <Input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmacao}
          {...register("confirmacao")}
        />
        {errors.confirmacao && <FieldError>{errors.confirmacao.message}</FieldError>}
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
        {pendente ? "Trocando…" : "Trocar senha"}
      </Button>
    </form>
  );
}
