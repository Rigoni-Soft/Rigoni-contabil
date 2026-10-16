import { AlertTriangle, LogOut } from "lucide-react";

import { Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type LogoutButtonProps = {
  formAction: (formData: FormData) => void;
  pendente: boolean;
  erro?: string;
};

export function LogoutButton({ formAction, pendente, erro }: LogoutButtonProps) {
  return (
    <Linha alinhar="centro" espaco={2} como="form" action={formAction}>
      {erro && (
        <Texto variante="alerta" role="alert" className="flex items-center gap-1">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {erro}
        </Texto>
      )}
      <Button type="submit" variant="ghost" size="sm" disabled={pendente}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </Linha>
  );
}
