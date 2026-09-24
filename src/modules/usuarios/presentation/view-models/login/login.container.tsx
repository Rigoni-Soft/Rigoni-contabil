"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { LoginForm } from "@/presentation/components/organisms/login-form.component";

import { loginAction } from "./login.actions";
import { loginSchema, type LoginFormValues } from "./login.schema";

export function LoginContainer() {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const aoSubmeter = handleSubmit(async (valores) => {
    setPendente(true);
    setErroServidor(undefined);

    const resultado = await loginAction(valores);

    setPendente(false);
    if (!resultado.ok) {
      setErroServidor(resultado.error.message);
      return;
    }

    router.push("/");
    router.refresh();
  });

  return (
    <LoginForm
      register={register}
      errors={errors}
      onSubmit={aoSubmeter}
      pendente={pendente}
      erroServidor={erroServidor}
    />
  );
}
