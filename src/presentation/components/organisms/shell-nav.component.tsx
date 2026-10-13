import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ChipDeSetor } from "@/presentation/components/atoms/chip-de-setor.component";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type SetorNav = { slug: string };

type ShellNavProps = { setores: SetorNav[] };

// Única aba com tela de verdade por trás (#36) — as demais seguem como
// placeholder desabilitado até ganharem painel próprio.
const ROTA_POR_SETOR: Record<string, string> = {
  simples_nacional: "/simples-nacional",
};

export function ShellNav({ setores }: ShellNavProps) {
  return (
    <Caixa
      como="nav"
      aria-label="Setores"
      className="flex flex-wrap gap-2 border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      {setores.map((setor) => (
        <ChipDeSetor key={setor.slug} href={ROTA_POR_SETOR[setor.slug]}>
          {SETOR_LABEL[setor.slug] ?? setor.slug}
        </ChipDeSetor>
      ))}
    </Caixa>
  );
}
