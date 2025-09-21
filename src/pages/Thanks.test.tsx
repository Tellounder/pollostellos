/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Thanks } from "pages/Thanks";

describe("Thanks Page", () => {
  it("renders the thank you message", () => {
    render(
      <MemoryRouter>
        <Thanks />
      </MemoryRouter>
    );

    expect(screen.getByText("¡Gracias por tu compra! ✅")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tu pedido fue enviado por WhatsApp. Te vamos a escribir para confirmar."
      )
    ).toBeInTheDocument();
  });
});