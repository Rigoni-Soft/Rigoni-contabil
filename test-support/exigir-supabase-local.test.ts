import { exigirSupabaseLocal } from "./exigir-supabase-local";

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
