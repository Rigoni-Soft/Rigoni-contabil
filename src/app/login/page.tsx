import { LoginPage } from "@/presentation/components/pages/login.page";
import { LoginContainer } from "@/modules/usuarios/presentation/view-models/login/login.container";

export default function Page() {
  return <LoginPage formulario={<LoginContainer />} />;
}
