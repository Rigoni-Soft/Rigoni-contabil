import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";

export function CartaoDaTela({ children }: { children: React.ReactNode }) {
  return (
    <Pilha espaco={6} className={MOLDURA_DO_CARTAO}>
      {children}
    </Pilha>
  );
}
