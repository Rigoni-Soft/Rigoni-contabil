import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type PainelDoClienteProps = {
  titulo: string;
  // O foco vai para o título ao abrir o painel (quem usa teclado/leitor de tela não perde o contexto).
  tituloRef: React.Ref<HTMLElement>;
  onNovaBusca: () => void;
  // Formulário do cadastro operacional (slot: é um Container).
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
      <Caixa className="flex items-center justify-between gap-4">
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
      </Caixa>
      {children}
    </Pilha>
  );
}
