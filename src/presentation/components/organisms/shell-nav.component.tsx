import Link from "next/link";
import { Settings } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { MenuSuspenso } from "@/presentation/components/ui/menu-suspenso";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";
import { ROTA_POR_SETOR, SETOR_LABEL } from "@/shared/kernel/setores";

const MAXIMO_DE_SETORES_COMO_CHIPS = 2;

type SetorNav = { slug: string };
type ItemDeConfiguracao = { rotulo: string; href: string };

export type ShellNavProps = {
  setores: SetorNav[];
  rotaAtual?: string;
  pendentesDeAtendimento?: number;
  anuncio?: string;
  onIrParaSetor?: (rota: string) => void;
  configuracoes?: ItemDeConfiguracao[];
};

const CHIP =
  "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm pointer-coarse:min-h-11";

export function ShellNav({
  setores,
  rotaAtual,
  pendentesDeAtendimento = 0,
  anuncio = "",
  onIrParaSetor,
  configuracoes,
}: ShellNavProps) {
  const ativa = rotaAtual === ROTA_ATENDIMENTO;
  const comSeletor = onIrParaSetor !== undefined && setores.length > MAXIMO_DE_SETORES_COMO_CHIPS;
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
      {configuracoes && configuracoes.length > 0 && (
        <MenuSuspenso
          rotulo="Configurações do Setor"
          icone={<Settings aria-hidden="true" className="size-4" />}
          className="ml-auto"
        >
          <Caixa como="ul">
            {configuracoes.map((item) => (
              <Caixa como="li" key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent pointer-coarse:py-3"
                >
                  {item.rotulo}
                </Link>
              </Caixa>
            ))}
          </Caixa>
        </MenuSuspenso>
      )}
      <Texto como="span" variante="somenteLeitor" role="status">
        {anuncio}
      </Texto>
    </Linha>
  );
}
