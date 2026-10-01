"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";

import { useBuscarCliente } from "./use-buscar-cliente.hook";

type Props = { papel: string; setor: string; apenasSnMei?: boolean };

const ID_LISTA = "buscar-cliente-lista";
const idOpcao = (indice: number) => `buscar-cliente-opcao-${indice}`;

export function BuscarClienteContainer({ papel, setor, apenasSnMei = false }: Props) {
  const router = useRouter();
  const {
    termo,
    setTermo,
    buscando,
    sugestoesVisiveis,
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    readOnly,
  } = useBuscarCliente(papel, setor, apenasSnMei);

  // Destaque de teclado (ArrowUp/ArrowDown/Enter) na lista de sugestões —
  // estado puramente visual/efêmero, então fica no Container, não no hook
  // (arquitetura.md §4.7: "UI efêmera e visual... useState no Container").
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  // Sem efeito pra "resetar ao mudar a lista": deriva direto no render (React
  // recomenda: evita o cascading render de setState dentro de useEffect).
  // Continua válido só enquanto apontar pra dentro da lista atual.
  const indiceAtivoValido =
    indiceAtivo !== null && indiceAtivo < sugestoesVisiveis.length ? indiceAtivo : null;

  // Foco move pro título do painel ao selecionar um cliente — sem isso, quem
  // navega por teclado/leitor de tela perde o contexto da troca (a lista de
  // sugestões desaparece e o formulário aparece sem nenhum anúncio).
  const tituloPainelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (clienteSelecionado) tituloPainelRef.current?.focus();
  }, [clienteSelecionado]);

  const aoTeclar: React.KeyboardEventHandler<HTMLInputElement> = (evento) => {
    if (sugestoesVisiveis.length === 0) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((atual) =>
        atual === null ? 0 : Math.min(atual + 1, sugestoesVisiveis.length - 1),
      );
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((atual) =>
        atual === null ? sugestoesVisiveis.length - 1 : Math.max(atual - 1, 0),
      );
    } else if (evento.key === "Enter" && indiceAtivoValido !== null) {
      evento.preventDefault();
      selecionarCliente(sugestoesVisiveis[indiceAtivoValido].id);
    } else if (evento.key === "Escape") {
      setTermo("");
    }
  };

  if (clienteSelecionado) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2
            ref={tituloPainelRef}
            tabIndex={-1}
            className="rounded text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional"}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={fecharPainel}>
            Nova busca
          </Button>
        </div>
        <EditarCadastroOperacionalContainer
          dados={clienteSelecionado}
          readOnly={readOnly}
          onCancelar={fecharPainel}
          // Salvar fecha o painel (volta pra busca) e atualiza os dados da
          // página — se esta busca estiver embutida no resumo do setor
          // (/simples-nacional), os cards refletem a mudança na hora
          // (feedback de teste manual do #36).
          aoSalvarComSucesso={() => {
            fecharPainel();
            router.refresh();
          }}
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Buscar cliente</h2>
      <div className="space-y-1">
        <Label htmlFor="buscar-cliente-termo">Empresa ou CNPJ</Label>
        <Input
          id="buscar-cliente-termo"
          placeholder="Digite ao menos 3 caracteres"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={aoTeclar}
          role="combobox"
          aria-expanded={sugestoesVisiveis.length > 0}
          aria-controls={ID_LISTA}
          aria-autocomplete="list"
          aria-activedescendant={
            indiceAtivoValido !== null ? idOpcao(indiceAtivoValido) : undefined
          }
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {buscando
          ? "Buscando..."
          : sugestoesVisiveis.length > 0
            ? `${sugestoesVisiveis.length} sugestão${sugestoesVisiveis.length > 1 ? "ões" : ""} encontrada${sugestoesVisiveis.length > 1 ? "s" : ""}.`
            : ""}
      </p>
      {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}

      {sugestoesVisiveis.length > 0 && (
        <ul
          id={ID_LISTA}
          role="listbox"
          aria-label="Sugestões de clientes"
          className="divide-y divide-border rounded-md border border-border"
        >
          {sugestoesVisiveis.map((sugestao, indice) => (
            <li
              key={sugestao.id}
              id={idOpcao(indice)}
              role="option"
              aria-selected={indice === indiceAtivoValido}
              onMouseEnter={() => setIndiceAtivo(indice)}
              onClick={() => selecionarCliente(sugestao.id)}
              className={`flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left ${
                indice === indiceAtivoValido ? "bg-accent" : ""
              }`}
            >
              <span className="font-medium text-foreground">{sugestao.empresa}</span>
              <span className="text-sm text-muted-foreground">{formatarCnpj(sugestao.cnpj)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
