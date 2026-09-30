"use client";

import { useEffect, useState } from "react";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import type {
  CadastroOperacionalClienteDto,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";

import { buscarClientesAction, carregarCadastroOperacionalAction } from "./buscar-cliente.actions";

type Props = { papel: string; setor: string };

const TAMANHO_MINIMO_TERMO = 3;
const DEBOUNCE_MS = 300;

export function BuscarClienteContainer({ papel, setor }: Props) {
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoClienteDto[]>([]);
  const [clienteSelecionado, setClienteSelecionado] =
    useState<CadastroOperacionalClienteDto | null>(null);
  const [buscando, setBuscando] = useState(false);

  // Debounce simples (stdlib) — evita disparar a action a cada tecla digitada.
  // Abaixo do mínimo, nenhum timer dispara: a lista permanece escondida (ver
  // sugestoesVisiveis abaixo) sem precisar resetar estado dentro do efeito.
  useEffect(() => {
    if (termo.trim().length < TAMANHO_MINIMO_TERMO) return;

    const timer = setTimeout(async () => {
      setBuscando(true);
      const resultado = await buscarClientesAction({ termo: termo.trim() });
      setBuscando(false);
      setSugestoes(resultado.ok ? resultado.data : []);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [termo]);

  const sugestoesVisiveis = termo.trim().length >= TAMANHO_MINIMO_TERMO ? sugestoes : [];

  const selecionarCliente = async (id: string) => {
    const resultado = await carregarCadastroOperacionalAction(id);
    setClienteSelecionado(resultado.ok ? resultado.data : null);
    setSugestoes([]);
    setTermo("");
  };

  const readOnly = !(
    papel === "admin" ||
    (papel === "funcionario" && setor === "simples_nacional")
  );

  // Mesma ação por trás de "Nova busca" (topo) e "Cancelar" (dentro do form,
  // #35 corrige: sem isso o <Link href="/"> do form não fazia nada, já que a
  // busca já está em "/") — fecha o painel e volta pro campo de busca.
  const fecharPainel = () => setClienteSelecionado(null);

  if (clienteSelecionado) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
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
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {buscando ? "Buscando..." : ""}
      </p>
      {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}

      {sugestoesVisiveis.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {sugestoesVisiveis.map((sugestao) => (
            <li key={sugestao.id}>
              <button
                type="button"
                onClick={() => selecionarCliente(sugestao.id)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
              >
                <span className="font-medium text-foreground">{sugestao.empresa}</span>
                <span className="text-sm text-muted-foreground">{formatarCnpj(sugestao.cnpj)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
