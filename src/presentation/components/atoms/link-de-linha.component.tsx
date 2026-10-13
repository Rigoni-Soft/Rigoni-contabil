import Link from "next/link";

// Link que ocupa a linha inteira de uma lista de navegação.
export function LinkDeLinha({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
    >
      {children}
    </Link>
  );
}
