type ShellHeaderProps = {
  nome: string;
  papel: string;
  setor: string;
  sair: React.ReactNode;
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  lider_setor: "Líder de setor",
  funcionario: "Funcionário",
};

export function ShellHeader({ nome, papel, setor, sair }: ShellHeaderProps) {
  const escopo = papel === "admin" ? "acesso a todos os setores" : `Setor: ${setor}`;

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div>
        <p className="font-medium">{nome}</p>
        <p className="text-sm text-gray-500">
          {PAPEL_LABEL[papel] ?? papel} · {escopo}
        </p>
      </div>
      {sair}
    </header>
  );
}
