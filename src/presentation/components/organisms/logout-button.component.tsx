import { AlertTriangle, LogOut } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type LogoutButtonProps = {
  formAction: (formData: FormData) => void;
  pendente: boolean;
  erro?: string;
};

export function LogoutButton({ formAction, pendente, erro }: LogoutButtonProps) {
  return (
    <form action={formAction} className="flex items-center gap-2">
      {erro && (
        <p role="alert" className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
      <Button type="submit" variant="ghost" size="sm" disabled={pendente}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </form>
  );
}
