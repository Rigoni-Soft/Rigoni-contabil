import { render } from "@testing-library/react";

import { AvisoGlobalContainer } from "./aviso-global.container";
import { useAvisoGlobal } from "./use-aviso-global.hook";

jest.mock("./use-aviso-global.hook", () => ({
  useAvisoGlobal: jest.fn(),
}));

describe("AvisoGlobalContainer", () => {
  it("aciona o hook de aviso global e não renderiza nós de interface", () => {
    const { container } = render(<AvisoGlobalContainer />);

    expect(useAvisoGlobal).toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });
});
