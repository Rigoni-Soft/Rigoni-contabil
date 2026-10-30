import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type SetorNav = { slug: string };

// `rotaAtual`: a aba da tela aberta ganha o destaque cheio (e `aria-current`); em "/" nenhuma está
// selecionada, e as que têm tela são só links comuns.
// `pendentesDeAtendimento`: espera do Setor + conversas com o cliente aguardando. `anuncio`: o
// texto que o leitor de tela lê quando esse contador cresce.
export type ShellNavProps = {
  setores: SetorNav[];
  rotaAtual?: string;
  pendentesDeAtendimento?: number;
  anuncio?: string;
  // Com muitos Setores (o Admin) e este destino, o celular troca os chips por um seletor; sem ele
  // (ou com poucos Setores) os chips seguem em todo tamanho.
  onIrParaSetor?: (rota: string) => void;
};

// Única aba com tela de verdade por trás — as demais seguem como
// placeholder desabilitado até ganharem painel próprio.
const ROTA_POR_SETOR: Record<string, string> = {
  simples_nacional: "/simples-nacional",
};

const CHIP =
  "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm pointer-coarse:min-h-11";

export function ShellNav({
  setores,
  rotaAtual,
  pendentesDeAtendimento = 0,
  anuncio = "",
  onIrParaSetor,
}: ShellNavProps) {
  const ativa = rotaAtual === ROTA_ATENDIMENTO;
  const comSeletor = onIrParaSetor !== undefined && setores.length > 2;
  // Só um Setor com tela pode ser o atual (sem rota, `undefined === undefined` casaria o primeiro).
  const setorAtual =
    (rotaAtual && setores.find((s) => ROTA_POR_SETOR[s.slug] === rotaAtual)?.slug) || "";
  return (
    <Linha
      espaco={2}
      quebra
      como="nav"
      aria-label="Setores"
      className="border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      {comSeletor && (
        <Select
          aria-label="Ir para o Setor"
          value={setorAtual}
          onChange={(e) => {
            const rota = ROTA_POR_SETOR[e.target.value];
            if (rota) onIrParaSetor(rota);
          }}
          className="min-w-0 flex-1 sm:hidden"
        >
          <Opcao value="">Setor</Opcao>
          {setores.map(({ slug }) => (
            <Opcao key={slug} value={slug} disabled={!ROTA_POR_SETOR[slug]}>
              {SETOR_LABEL[slug] ?? slug}
              {ROTA_POR_SETOR[slug] ? "" : " — em breve"}
            </Opcao>
          ))}
        </Select>
      )}
      {setores.map((setor) => {
        const rota = ROTA_POR_SETOR[setor.slug];
        const label = SETOR_LABEL[setor.slug] ?? setor.slug;
        return rota ? (
          <Link
            key={setor.slug}
            href={rota}
            aria-current={rota === rotaAtual ? "page" : undefined}
            className={cn(
              CHIP,
              comSeletor && "max-sm:hidden",
              rota === rotaAtual
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "text-foreground hover:bg-accent",
            )}
          >
            {label}
          </Link>
        ) : (
          <Caixa
            como="span"
            key={setor.slug}
            aria-disabled="true"
            title="Tela ainda não construída"
            className={cn(
              CHIP,
              comSeletor && "max-sm:hidden",
              "cursor-not-allowed text-muted-foreground pointer-coarse:min-h-0",
            )}
          >
            {label}
          </Caixa>
        );
      })}
      {/* Aba de todo login, ao lado das de Setor: leva à tela Atendimento (espera do Setor e conversas). */}
      <Link
        href={ROTA_ATENDIMENTO}
        aria-current={ativa ? "page" : undefined}
        aria-label={
          pendentesDeAtendimento > 0
            ? `Atendimento, ${pendentesDeAtendimento} ${pendentesDeAtendimento === 1 ? "pendente" : "pendentes"}`
            : undefined
        }
        className={cn(
          CHIP,
          "font-medium",
          ativa
            ? "border-primary bg-primary text-primary-foreground"
            : "text-foreground hover:bg-accent",
        )}
      >
        Atendimento
        {/* Zero some; acima de 99 vira 99+. Cor própria: o link ativo já é `primary` e a pílula sumiria
            nele, então ali ela ganha um anel `card`; nos demais o anel tem a cor do fundo da pílula (o
            hover do link não mostra um aro). */}
        {pendentesDeAtendimento > 0 && (
          <Caixa
            como="span"
            aria-hidden="true"
            className={cn(
              "ml-2 rounded-full border-2 bg-destructive px-1.5 text-xs text-destructive-foreground",
              ativa ? "border-card" : "border-destructive",
            )}
          >
            {pendentesDeAtendimento > 99 ? "99+" : pendentesDeAtendimento}
          </Caixa>
        )}
      </Link>
      {/* Montada desde o início (mesmo vazia): leitor de tela só anuncia região que já existia. */}
      <Texto como="span" variante="somenteLeitor" role="status">
        {anuncio}
      </Texto>
    </Linha>
  );
}
