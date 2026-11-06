import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type AvisoDeCadastro = {
  id: string;
  titulo: string;
  quando: string;
  visto: boolean;
  href: string;
};

type ItemDeAvisoProps = {
  aviso: AvisoDeCadastro;
  aoSelecionar: (aviso: AvisoDeCadastro) => void;
};

// Linha da lista de Avisos de cadastro: não visto em destaque (ponto `primary`, "novo" para leitor
// de tela); visto esmaecido, com o selo "visto" em texto (a cor não é o único sinal).
export function ItemDeAviso({ aviso, aoSelecionar }: ItemDeAvisoProps) {
  return (
    <Caixa
      como="button"
      type="button"
      data-visto={aviso.visto}
      onClick={() => aoSelecionar(aviso)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        aviso.visto
          ? "border-input bg-transparent text-muted-foreground"
          : "border-primary bg-accent font-medium text-foreground",
      )}
    >
      {!aviso.visto && (
        <Caixa
          como="span"
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full bg-primary"
        />
      )}
      <Caixa como="span" className="min-w-0 flex-1">
        {!aviso.visto && (
          <Texto variante="somenteLeitor" como="span">
            novo:{" "}
          </Texto>
        )}
        <Texto como="span" variante="corpo" className="block text-inherit">
          {aviso.titulo}
        </Texto>
        <Texto como="span" variante="nota" className="block">
          {aviso.quando}
        </Texto>
      </Caixa>
      {aviso.visto && (
        <Texto como="span" variante="rotulo" className="shrink-0 uppercase">
          visto
        </Texto>
      )}
    </Caixa>
  );
}
