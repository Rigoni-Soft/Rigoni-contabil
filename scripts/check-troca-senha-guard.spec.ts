/** Garante que o checker pega página que nem chama carregarSessao e que a checagem original não regride. */
import { classificarPagina } from "./check-troca-senha-guard.mjs";

describe("classificarPagina", () => {
  it("página pública (login) passa mesmo sem carregarSessao nem precisaTrocarSenha", () => {
    expect(
      classificarPagina("login/page.tsx", "export default function Login() { return null; }"),
    ).toBeNull();
  });

  it("página nova que esquece de chamar carregarSessao é pega (endurecimento do ajuste 2)", () => {
    const erro = classificarPagina(
      "admin/relatorio/page.tsx",
      "export default function Relatorio() { return <div />; }",
    );

    expect(erro).toBe(
      "admin/relatorio/page.tsx: não carrega a sessão (carregarSessao) — se for pública de propósito, adicione a PAGINAS_PUBLICAS",
    );
  });

  it("página que carrega sessão mas esquece precisaTrocarSenha é pega (checagem original)", () => {
    const erro = classificarPagina(
      "admin/relatorio/page.tsx",
      "const sessao = await carregarSessao(); return <div />;",
    );

    expect(erro).toBe(
      "admin/relatorio/page.tsx: carrega a sessão mas não checa precisaTrocarSenha",
    );
  });

  it("página que carrega sessão e checa precisaTrocarSenha passa", () => {
    const conteudo =
      "const sessao = await carregarSessao(); if (sessao.precisaTrocarSenha) redirect('/trocar-senha');";

    expect(classificarPagina("admin/relatorio/page.tsx", conteudo)).toBeNull();
  });

  it("trocar-senha/page.tsx é isenta de checar precisaTrocarSenha, mas ainda precisa de carregarSessao", () => {
    expect(
      classificarPagina("trocar-senha/page.tsx", "const sessao = await carregarSessao();"),
    ).toBeNull();

    expect(
      classificarPagina("trocar-senha/page.tsx", "export default function TrocarSenha() {}"),
    ).toBe(
      "trocar-senha/page.tsx: não carrega a sessão (carregarSessao) — se for pública de propósito, adicione a PAGINAS_PUBLICAS",
    );
  });
});
