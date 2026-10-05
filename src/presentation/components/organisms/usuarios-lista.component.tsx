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
  // Ação de cada linha, montada no servidor (arquitetura.md §4.6, regra 5): a
  // lista não vira código de cliente por causa de um botão.
  acoes: (usuario: UsuarioListado) => React.ReactNode;
};

export function UsuariosLista({ usuarios, acoes }: UsuariosListaProps) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-card">
      {usuarios.map((usuario) => (
        <li key={usuario.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{usuario.nome}</p>
            <p className="truncate text-sm text-muted-foreground">
              {usuario.email} · {PAPEL_LABEL[usuario.papel] ?? usuario.papel} · {usuario.setor}
            </p>
          </div>
          {acoes(usuario)}
        </li>
      ))}
    </ul>
  );
}
