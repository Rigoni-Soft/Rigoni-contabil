import Link from "next/link";
import { Building2, CalendarOff, CircleUser, ListOrdered, UserPlus, Users } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { buttonVariants } from "@/presentation/components/ui/button";
import { ThemeToggle } from "@/presentation/components/ui/theme-toggle";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type ShellHeaderProps = {
  nome: string;
  papel: string;
  setor: string;
  sair: React.ReactNode;
};

// Quem cada papel cadastra (#30/#32) — Funcionário não cadastra ninguém, por
// isso não entra neste mapa (o link de cadastro simplesmente não aparece pra ele).
const CADASTRAR_LABEL: Record<string, string> = {
  admin: "Cadastrar Líder",
  lider_setor: "Cadastrar Funcionário",
};

export function ShellHeader({ nome, papel, setor, sair }: ShellHeaderProps) {
  const escopo =
    papel === "admin" ? "acesso a todos os setores" : `Setor: ${SETOR_LABEL[setor] ?? setor}`;
  const inicial = nome.charAt(0).toUpperCase();
  const rotuloCadastrar = CADASTRAR_LABEL[papel];

  return (
    <Linha
      alinhar="centro"
      justificar="entre"
      espaco={4}
      como="header"
      className="border-b border-border bg-card px-4 py-3 sm:px-6"
    >
      <Linha alinhar="centro" espaco={3} className="min-w-0">
        <Caixa
          como="span"
          aria-hidden="true"
          className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground sm:flex"
        >
          {inicial}
        </Caixa>
        <Caixa className="min-w-0">
          <Texto variante="destaque" className="break-words sm:truncate">
            {nome}
          </Texto>
          <Texto variante="apoio" className="break-words sm:truncate">
            {PAPEL_LABEL[papel] ?? papel} · {escopo}
          </Texto>
        </Caixa>
      </Linha>

      <Linha alinhar="centro" espaco={1} className="shrink-0">
        {/* Único caminho de navegação até /admin/usuarios/novo — Admin e Líder
            cadastram (escopado por papel no próprio caso de uso, #30/#32);
            Funcionário não cadastra ninguém, então não vê o link. */}
        {rotuloCadastrar && (
          <Link
            href="/admin/usuarios/novo"
            aria-label={rotuloCadastrar}
            className={buttonVariants({ variant: "ghost" })}
          >
            <UserPlus aria-hidden="true" />
            <Texto variante="ocultoNoCelular" como="span">
              {rotuloCadastrar}
            </Texto>
          </Link>
        )}
        {/* Único caminho de navegação até /admin/clientes/novo — só Admin cadastra
            Cliente nesta rodada (#33). Sem isso a tela só era alcançável digitando
            a URL direto, mesmo gap já identificado em #31/#32. */}
        {papel === "admin" && (
          <Link
            href="/admin/clientes/novo"
            aria-label="Cadastrar Cliente"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Building2 aria-hidden="true" />
            <Texto variante="ocultoNoCelular" como="span">
              Cadastrar Cliente
            </Texto>
          </Link>
        )}
        {papel === "admin" && (
          <Link
            href="/admin/usuarios"
            aria-label="Usuários"
            className={buttonVariants({ variant: "ghost" })}
          >
            <Users aria-hidden="true" />
            <Texto variante="ocultoNoCelular" como="span">
              Usuários
            </Texto>
          </Link>
        )}
        {/* Só o Admin: ele não tem Setor nem barra lateral na conversa e vê a Fila de qualquer
            Setor aqui (#70). Os demais têm a Fila na conversa e o cartão no dock. */}
        {papel === "admin" && (
          <Link href="/fila" aria-label="Fila" className={buttonVariants({ variant: "ghost" })}>
            <ListOrdered aria-hidden="true" />
            <Texto variante="ocultoNoCelular" como="span">
              Fila
            </Texto>
          </Link>
        )}
        {/* Caminho até /admin/feriados (#72): só o Admin cadastra feriados. */}
        {papel === "admin" && (
          <Link
            href="/admin/feriados"
            aria-label="Feriados"
            className={buttonVariants({ variant: "ghost" })}
          >
            <CalendarOff aria-hidden="true" />
            <Texto variante="ocultoNoCelular" como="span">
              Feriados
            </Texto>
          </Link>
        )}
        {/* Único caminho de navegação até /perfil (#56), onde mora a troca voluntária
            de senha — a /trocar-senha fica só pro redirecionamento obrigatório (#31). */}
        <Link
          href="/perfil"
          aria-label="Meu perfil"
          className={buttonVariants({ variant: "ghost" })}
        >
          <CircleUser aria-hidden="true" />
          <Texto variante="ocultoNoCelular" como="span">
            Meu perfil
          </Texto>
        </Link>
        <ThemeToggle />
        {sair}
      </Linha>
    </Linha>
  );
}
