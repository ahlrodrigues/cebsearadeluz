import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api/cep", () => ({
  lookupCep: vi.fn().mockResolvedValue({
    street: "Rua Teste",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
  }),
}));

import UserForm from "../UserForm";
import { DEFAULT_VALUES } from "../values";

type UserFormProps = ComponentProps<typeof UserForm>;

const renderCreateForm = (props?: Partial<UserFormProps>) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <UserForm
      mode="create"
      initialValues={{ ...DEFAULT_VALUES }}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { ...utils, onSubmit };
};

describe("UserForm - create mode", () => {
  it("prevents submission when passwords do not match and submits after correction", async () => {
    const { onSubmit } = renderCreateForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nome completo/i), "Joana Silva");
    await user.type(screen.getByLabelText(/E-mail/i), "joana@example.com");
    const passwordInputs = screen.getAllByLabelText(/Senha/i);
    await user.type(passwordInputs[0], "SenhaSegura1");
    await user.type(screen.getByLabelText(/Confirmar senha/i), "SenhaInvalida");

    await user.click(screen.getByRole("button", { name: /Salvar assistido/i }));

    expect(
      await screen.findByText("As senhas não coincidem."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    const confirmPasswordInput = screen.getByLabelText(/Confirmar senha/i);
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, "SenhaSegura1");

    await user.click(screen.getByRole("button", { name: /Salvar assistido/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      full_name: "Joana Silva",
      social_name: undefined,
      birth_date: undefined,
      cep: undefined,
      street: undefined,
      number: undefined,
      complement: undefined,
      neighborhood: undefined,
      city: undefined,
      state: undefined,
      phone: undefined,
      email: "joana@example.com",
      social_network: undefined,
      status: "Ativo",
      role: "user",
      password: "SenhaSegura1",
    });
  }, 10000);
});

describe("UserForm - edit mode", () => {
  it("submits updated data without requiring password", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const initialValues = {
      full_name: "Maria Souza",
      email: "maria@example.com",
      status: "Desativado" as const,
      role: "admin" as const,
      phone: "(11)98888-0000",
    };

    render(
      <UserForm
        mode="edit"
        initialValues={initialValues}
        onSubmit={onSubmit}
      />,
    );

    const phoneInput = screen.getByLabelText(/Telefone/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, "(11)97777-1111");

    await user.click(
      screen.getByRole("button", { name: /Salvar alterações/i }),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).toMatchObject({
      full_name: "Maria Souza",
      phone: "(11)97777-1111",
      status: "Desativado",
      role: "admin",
    });
    expect(submitted).not.toHaveProperty("password");
  }, 10000);
});
