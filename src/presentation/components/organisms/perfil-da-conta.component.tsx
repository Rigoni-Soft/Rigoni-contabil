import { Fragment } from "react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type PerfilDaContaProps = {
  nome: string;
  email: string;
  papel: string;
  setor: string;
  // Formulário de troca de senha (slot: é um Container).
  formulario: React.ReactNode;
};

// Dados da conta (leitura) seguidos da seção "Trocar senha".
export function PerfilDaConta({ nome, email, papel, setor, formulario }: PerfilDaContaProps) {
  const dados = [
    { rotulo: "Nome", valor: nome },
    { rotulo: "E-mail", valor: email },
    { rotulo: "Papel", valor: PAPEL_LABEL[papel] ?? papel },
    {
      rotulo: "Setor",
      valor: papel === "admin" ? "Todos os setores" : (SETOR_LABEL[setor] ?? setor),
    },
  ];

  return (
    <>
      <Caixa como="dl" className="mb-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {dados.map(({ rotulo, valor }) => (
          <Fragment key={rotulo}>
            <Caixa como="dt" className="text-muted-foreground">
              {rotulo}
            </Caixa>
            <Caixa como="dd" className="min-w-0 font-medium break-words text-foreground">
              {valor}
            </Caixa>
          </Fragment>
        ))}
      </Caixa>
      <Caixa
        como="section"
        aria-labelledby="trocar-senha-titulo"
        className="border-t border-border pt-8"
      >
        <Texto
          variante="livre"
          como="h2"
          id="trocar-senha-titulo"
          className="mb-2 text-lg font-semibold text-foreground"
        >
          Trocar senha
        </Texto>
        <Texto variante="apoio" className="mb-6">
          Defina uma nova senha para sua conta.
        </Texto>
        {formulario}
      </Caixa>
    </>
  );
}
