import Link from "next/link";

import { AnelDeProgresso } from "@/presentation/components/atoms/anel-de-progresso.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { corDeStatus } from "@/presentation/lib/cor-de-status";

type CartaoDeResumoProps = {
  href: string;
  titulo: string;
  cor: string;
  quantidade: number;
  totalClientes: number;
};

// Um status do resumo do setor: anel proporcional + título; leva à lista de Clientes do status.
export function CartaoDeResumo({
  href,
  titulo,
  cor,
  quantidade,
  totalClientes,
}: CartaoDeResumoProps) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center shadow-sm transition-colors hover:border-ring hover:bg-accent/50"
    >
      <AnelDeProgresso
        quantidade={quantidade}
        total={totalClientes}
        classe={corDeStatus(cor).traco}
      />
      <Texto variante="corpo" className="font-semibold">
        {titulo}
        <Texto variante="somenteLeitor" como="span">
          {" "}
          — {quantidade} de {totalClientes} {totalClientes === 1 ? "cliente" : "clientes"}
        </Texto>
      </Texto>
    </Link>
  );
}
