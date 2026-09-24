import type { FieldErrors, UseFormRegister } from "react-hook-form";

type LoginFormValues = { email: string; senha: string };

type LoginFormProps = {
  register: UseFormRegister<LoginFormValues>;
  errors: FieldErrors<LoginFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
};

export function LoginForm({ register, errors, onSubmit, pendente, erroServidor }: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="rounded-md border px-3 py-2"
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className="text-sm font-medium">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          className="rounded-md border px-3 py-2"
          {...register("senha")}
        />
        {errors.senha && <p className="text-sm text-red-600">{errors.senha.message}</p>}
      </div>

      {erroServidor && <p className="text-sm text-red-600">{erroServidor}</p>}

      <button
        type="submit"
        disabled={pendente}
        className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
