"use client";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";

import { useBuscarCliente } from "./use-buscar-cliente.hook";

type Props = { papel: string; setor: string };

export function BuscarClienteContainer({ papel, setor }: Props) {
  const {
    termo,
    setTermo,
    buscando,
    sugestoesVisiveis,
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    readOnly,
  } = useBuscarCliente(papel, setor);

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
