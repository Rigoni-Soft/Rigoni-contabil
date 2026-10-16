import Link from "next/link";

import { AnelDeProgresso } from "@/presentation/components/atoms/anel-de-progresso.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

// "Em dia" e "em andamento" usam a mesma tinta.
const ANEL_POR_COR: Record<string, string> = {
  em_dia: "stroke-primary",
  atencao: "stroke-success",
  urgente: "stroke-destructive",
  informativo: "stroke-muted-foreground",
  andamento: "stroke-primary",
};

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
        classe={ANEL_POR_COR[cor] ?? ANEL_POR_COR.informativo}
      />
      <Texto variante="corpo" className="font-semibold">
        {titulo}
        <Texto variante="somenteLeitor" como="span">
          {" "}
          — {quantidade} de {totalClientes} clientes
        </Texto>
      </Texto>
    </Link>
  );
}
