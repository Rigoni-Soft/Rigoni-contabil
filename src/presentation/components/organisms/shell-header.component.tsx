import Link from "next/link";
import { Building2, CalendarOff, CircleUser, UserPlus, Users } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { BotaoDoMenu } from "@/presentation/components/ui/botao-do-menu";
import { buttonVariants } from "@/presentation/components/ui/button";
import { ThemeToggle } from "@/presentation/components/ui/theme-toggle";
import { cn } from "@/presentation/lib/utils";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type ShellHeaderProps = {
  nome: string;
  papel: string;
  setor: string;
  // Sino de Avisos de cadastro: é um Container (módulo clientes), que a View não importa.
  avisos: React.ReactNode;
  sair: React.ReactNode;
};

// Quem cada papel cadastra — Funcionário não cadastra ninguém, por isso não entra neste mapa
// (o link de cadastro simplesmente não aparece pra ele).
const CADASTRAR_LABEL: Record<string, string> = {
  admin: "Cadastrar Líder",
  lider_setor: "Cadastrar Funcionário",
};

const ID_DO_MENU = "menu-do-shell";

// As ações são um só conjunto de elementos. Abaixo de `sm` ele é um menu (popover nativo: fecha com
// Esc ou clicando fora e devolve o foco ao botão): cada item ganha o rótulo e ocupa a largura toda.
// De `sm` para cima o popover vira a linha de ações de sempre (só ícones até `lg`), sem posição de
// camada nem moldura. O sino fica fora dele, sempre à vista.
const MENU =
  "max-sm:fixed max-sm:inset-auto max-sm:top-[4.5rem] max-sm:right-4 max-sm:m-0 max-sm:w-[min(18rem,calc(100vw-2rem))] max-sm:flex-col max-sm:items-stretch max-sm:gap-1 max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:bg-card max-sm:p-2 max-sm:text-foreground max-sm:shadow-md max-sm:[&:popover-open]:flex " +
  "sm:static sm:m-0 sm:flex sm:flex-wrap sm:items-center sm:gap-1 sm:overflow-visible sm:border-0 sm:bg-transparent sm:p-0";
const ITEM = "max-sm:w-full max-sm:justify-start max-sm:gap-2 max-sm:px-4";
// O rótulo aparece no menu (celular) e, como antes, só de `lg` para cima na linha.
const ROTULO = "max-sm:inline";

export function ShellHeader({ nome, papel, setor, avisos, sair }: ShellHeaderProps) {
  const escopo =
    papel === "admin" ? "acesso a todos os setores" : `Setor: ${SETOR_LABEL[setor] ?? setor}`;
  const inicial = nome.charAt(0).toUpperCase();
  const rotuloCadastrar = CADASTRAR_LABEL[papel];
  const item = cn(buttonVariants({ variant: "ghost" }), ITEM);

  return (
    <Linha
      espaco={3}
      como="header"
      // Celular: uma linha só (identidade + sino + Menu). De `sm` para cima, identidade e ações
      // dividem a linha quando cabem e quebram quando não cabem (o Admin tem 5 ações + tema + Sair;
      // reflow a 320 px, WCAG 1.4.10). De lg para cima, uma linha só.
      className="flex-nowrap items-center justify-between gap-y-2 border-b border-border bg-card px-4 py-3 sm:flex-wrap sm:px-6 lg:flex-nowrap lg:gap-4"
    >
      <Linha alinhar="centro" espaco={3} className="min-w-0 flex-1 basis-40">
        <Caixa
          como="span"
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {inicial}
        </Caixa>
        <Caixa className="min-w-0">
          <Texto variante="destaque" className="truncate" title={nome}>
            {nome}
          </Texto>
          <Texto variante="apoio" className="truncate">
            {PAPEL_LABEL[papel] ?? papel} · {escopo}
          </Texto>
        </Caixa>
      </Linha>

      <Linha alinhar="centro" espaco={1} className="shrink-0 sm:max-w-full lg:shrink-0">
        {/* O Admin não recebe Aviso de cadastro: sem sino. */}
        {papel !== "admin" && avisos}
        <BotaoDoMenu alvoId={ID_DO_MENU} className="sm:hidden" />
        <Caixa id={ID_DO_MENU} popover="auto" className={MENU}>
          {/* Único caminho de navegação até /admin/usuarios/novo — Admin e Líder
            cadastram (escopado por papel no próprio caso de uso); Funcionário não
            cadastra ninguém, então não vê o link. */}
          {rotuloCadastrar && (
            <Link href="/admin/usuarios/novo" aria-label={rotuloCadastrar} className={item}>
              <UserPlus aria-hidden="true" />
              <Texto variante="soDesktop" como="span" className={ROTULO}>
                {rotuloCadastrar}
              </Texto>
            </Link>
          )}
          {/* Único caminho de navegação até /admin/clientes/novo — só Admin cadastra
            Cliente. Sem isso a tela só era alcançável digitando a URL direto. */}
          {papel === "admin" && (
            <Link href="/admin/clientes/novo" aria-label="Cadastrar Cliente" className={item}>
              <Building2 aria-hidden="true" />
              <Texto variante="soDesktop" como="span" className={ROTULO}>
                Cadastrar Cliente
              </Texto>
            </Link>
          )}
          {papel === "admin" && (
            <Link href="/admin/usuarios" aria-label="Usuários" className={item}>
              <Users aria-hidden="true" />
              <Texto variante="soDesktop" como="span" className={ROTULO}>
                Usuários
              </Texto>
            </Link>
          )}
          {/* Caminho até /admin/feriados: só o Admin cadastra feriados. */}
          {papel === "admin" && (
            <Link href="/admin/feriados" aria-label="Feriados" className={item}>
              <CalendarOff aria-hidden="true" />
              <Texto variante="soDesktop" como="span" className={ROTULO}>
                Feriados
              </Texto>
            </Link>
          )}
          {/* Único caminho de navegação até /perfil, onde mora a troca voluntária
            de senha — a /trocar-senha fica só pro redirecionamento obrigatório. */}
          <Link href="/perfil" aria-label="Meu perfil" className={item}>
            <CircleUser aria-hidden="true" />
            <Texto variante="soDesktop" como="span" className={ROTULO}>
              Meu perfil
            </Texto>
          </Link>
          <ThemeToggle className={ITEM} />
          {sair}
        </Caixa>
      </Linha>
    </Linha>
  );
}
