import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type PainelDoClienteProps = {
  titulo: string;
  tituloRef: React.Ref<HTMLElement>;
  onNovaBusca: () => void;
  children: React.ReactNode;
};

export function PainelDoCliente({
  titulo,
  tituloRef,
  onNovaBusca,
  children,
}: PainelDoClienteProps) {
  return (
    <Pilha espaco={3} como="section">
      <Linha alinhar="centro" justificar="entre" espaco={4}>
        <Texto
          como="h2"
          variante="subtitulo"
          ref={tituloRef}
          tabIndex={-1}
          className="rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {titulo}
        </Texto>
        <Button type="button" variant="ghost" size="sm" onClick={onNovaBusca}>
          Nova busca
        </Button>
      </Linha>
      {children}
    </Pilha>
  );
}
