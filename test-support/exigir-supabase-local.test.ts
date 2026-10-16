import { exigirDestinoDoE2E, exigirSupabaseLocal } from "./exigir-supabase-local";

describe("exigirSupabaseLocal", () => {
  it("aceita loopback", () => {
    expect(() =>
      exigirSupabaseLocal(
        "http://127.0.0.1:54321",
        "postgresql://postgres:postgres@localhost:54322/postgres",
      ),
    ).not.toThrow();
  });

  it("recusa destino remoto, inclusive com loopback só no usuário ou no caminho", () => {
    expect(() => exigirSupabaseLocal("https://abc.supabase.co")).toThrow();
    expect(() =>
      exigirSupabaseLocal("postgresql://127.0.0.1@db.remoto.com:5432/postgres"),
    ).toThrow();
    expect(() => exigirSupabaseLocal("https://remoto.com/127.0.0.1")).toThrow();
  });
});

describe("exigirDestinoDoE2E", () => {
  const ref = "zdyyeborkkdwskocimby";
  const homolog = `https://${ref}.supabase.co`;
  const deploy = "https://rigoni-cont.vercel.app";

  it("aceita o Supabase de homologação só contra um deploy e com o ref declarado", () => {
    expect(() => exigirDestinoDoE2E(homolog, { baseUrl: deploy, refHomolog: ref })).not.toThrow();
  });

  it("recusa o mesmo destino sem deploy, sem ref ou com ref diferente", () => {
    expect(() => exigirDestinoDoE2E(homolog, { refHomolog: ref })).toThrow();
    expect(() => exigirDestinoDoE2E(homolog, { baseUrl: deploy })).toThrow();
    expect(() =>
      exigirDestinoDoE2E(homolog, { baseUrl: deploy, refHomolog: "aaaaaaaaaaaaaaaaaaaa" }),
    ).toThrow();
  });

  it("recusa qualquer outro host remoto, mesmo com ref declarado", () => {
    expect(() =>
      exigirDestinoDoE2E("https://outro-projeto-1234567.supabase.co", {
        baseUrl: deploy,
        refHomolog: ref,
      }),
    ).toThrow();
    expect(() =>
      exigirDestinoDoE2E(`${homolog}.evil.com`, { baseUrl: deploy, refHomolog: ref }),
    ).toThrow();
  });

  it("segue aceitando o loopback", () => {
    expect(() => exigirDestinoDoE2E("http://127.0.0.1:54321", {})).not.toThrow();
  });
});
