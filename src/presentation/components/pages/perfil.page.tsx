import { Fragment } from "react";

import { TelaDeTrabalhoTemplate } from "@/presentation/components/templates/tela-de-trabalho-template.component";
import { PAPEL_LABEL } from "@/shared/kernel/papeis";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type PerfilPageProps = {
  header: React.ReactNode;
  formulario: React.ReactNode;
  nome: string;
  email: string;
  papel: string;
  setor: string;
};

export function PerfilPage({ header, formulario, nome, email, papel, setor }: PerfilPageProps) {
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
    <TelaDeTrabalhoTemplate
      header={header}
      largura="conta"
      titulo="Meu perfil"
      conteudo={
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
            <p className="mb-6 text-sm text-muted-foreground">
              Defina uma nova senha para sua conta.
            </p>
            {formulario}
          </section>
        </>
      }
    />
  );
}
