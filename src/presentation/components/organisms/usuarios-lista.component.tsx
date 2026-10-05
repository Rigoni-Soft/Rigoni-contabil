import { AlertTriangle } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";

export type UsuarioListado = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
};

type UsuariosListaProps = {
  usuarios: UsuarioListado[];
  confirmandoId?: string;
  pendenteId?: string;
  erro?: string;
  aoPedirConfirmacao: (usuarioId: string) => void;
  aoCancelar: () => void;
  aoConfirmar: (usuarioId: string) => void;
};

// Admin nunca é desativado pela UI (#58) — a linha dele não tem ação.
export function UsuariosLista({
  usuarios,
  confirmandoId,
  pendenteId,
  erro,
  aoPedirConfirmacao,
  aoCancelar,
  aoConfirmar,
}: UsuariosListaProps) {
  return (
    <div className="space-y-3">
      {erro && (
        <p role="alert" className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {usuarios.map((usuario) => (
          <li key={usuario.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{usuario.nome}</p>
              <p className="truncate text-sm text-muted-foreground">
                {usuario.email} · {PAPEL_LABEL[usuario.papel] ?? usuario.papel} · {usuario.setor}
              </p>
            </div>
            {usuario.papel !== "admin" &&
              (confirmandoId === usuario.id ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    aria-label={`Confirmar desativação de ${usuario.nome}`}
                    onClick={() => aoConfirmar(usuario.id)}
                  >
                    Confirmar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={aoCancelar}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendenteId === usuario.id}
                  aria-label={`Desativar ${usuario.nome}`}
                  onClick={() => aoPedirConfirmacao(usuario.id)}
                >
                  Desativar
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
