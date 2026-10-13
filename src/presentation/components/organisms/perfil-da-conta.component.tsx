import { Fragment } from "react";

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
      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {dados.map(({ rotulo, valor }) => (
          <Fragment key={rotulo}>
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd className="min-w-0 font-medium break-words text-foreground">{valor}</dd>
          </Fragment>
        ))}
      </dl>
      <section aria-labelledby="trocar-senha-titulo" className="border-t border-border pt-8">
        <h2 id="trocar-senha-titulo" className="mb-2 text-lg font-semibold text-foreground">
          Trocar senha
        </h2>
        <Texto variante="apoio" className="mb-6">
          Defina uma nova senha para sua conta.
        </Texto>
        {formulario}
      </section>
    </>
  );
}
