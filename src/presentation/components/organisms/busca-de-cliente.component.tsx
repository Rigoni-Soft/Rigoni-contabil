import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { cn } from "@/presentation/lib/utils";

type Sugestao = { id: string; empresa: string; cnpj: string };

type BuscaDeClienteProps = {
  termo: string;
  onTermoChange: (termo: string) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  buscando: boolean;
  sugestoes: Sugestao[];
  // Destaque de teclado/mouse na lista de sugestões.
  indiceAtivo: number | null;
  onDestacar: (indice: number) => void;
  onSelecionar: (id: string) => void;
  idLista: string;
  idOpcao: (indice: number) => string;
};

function anuncio(buscando: boolean, quantidade: number) {
  if (buscando) return "Buscando…";
  if (quantidade === 0) return "";
  const plural = quantidade > 1;
  return `${quantidade} sugest${plural ? "ões" : "ão"} encontrada${plural ? "s" : ""}.`;
}

// Busca de Cliente por empresa ou CNPJ, com lista de sugestões (combobox + listbox).
export function BuscaDeCliente({
  termo,
  onTermoChange,
  onKeyDown,
  buscando,
  sugestoes,
  indiceAtivo,
  onDestacar,
  onSelecionar,
  idLista,
  idOpcao,
}: BuscaDeClienteProps) {
  return (
    <Pilha espaco={3} como="section">
      <Texto como="h2" variante="subtitulo">
        Buscar cliente
      </Texto>
      <Pilha espaco={1}>
        <Label htmlFor="buscar-cliente-termo">Empresa ou CNPJ</Label>
        <Input
          id="buscar-cliente-termo"
          placeholder="Digite ao menos 3 caracteres"
          value={termo}
          onChange={(evento) => onTermoChange(evento.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={sugestoes.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={indiceAtivo !== null ? idOpcao(indiceAtivo) : undefined}
        />
      </Pilha>

      <Texto variante="somenteLeitor" role="status" aria-live="polite">
        {anuncio(buscando, sugestoes.length)}
      </Texto>
      {buscando && <Texto variante="apoio">Buscando…</Texto>}

      {sugestoes.length > 0 && (
        <Caixa
          como="ul"
          id={idLista}
          role="listbox"
          aria-label="Sugestões de clientes"
          className="divide-y divide-border rounded-md border border-border"
        >
          {sugestoes.map((sugestao, indice) => (
            <Caixa
              como="li"
              key={sugestao.id}
              id={idOpcao(indice)}
              role="option"
              aria-selected={indice === indiceAtivo}
              onMouseEnter={() => onDestacar(indice)}
              onClick={() => onSelecionar(sugestao.id)}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left",
                indice === indiceAtivo && "bg-accent",
              )}
            >
              <Texto como="span" variante="destaque">
                {sugestao.empresa}
              </Texto>
              <Texto como="span" variante="apoio">
                {sugestao.cnpj}
              </Texto>
            </Caixa>
          ))}
        </Caixa>
      )}
    </Pilha>
  );
}
