import { describe, expect, it } from "vitest";

import {
  mapToCreatePayload,
  mapToUpdatePayload,
  mapUserResponseToFormValues,
  normalizeInitialValues,
} from "../utils";
import type { UserResponse } from "../../../api/users";

const baseFormValues = normalizeInitialValues();

describe("user form utils", () => {
  it("mapToCreatePayload removes blanks and trims text", () => {
    const payload = mapToCreatePayload({
      ...baseFormValues,
      full_name: "  Ana Maria  ",
      social_name: "  ",
      state: " sp ",
      email: " user@example.com ",
      password: "senhaSegura",
    });

    expect(payload).toEqual({
      full_name: "Ana Maria",
      social_name: undefined,
      birth_date: undefined,
      cep: undefined,
      street: undefined,
      number: undefined,
      complement: undefined,
      neighborhood: undefined,
      city: undefined,
      state: "SP",
      phone: undefined,
      email: "user@example.com",
      social_network: undefined,
      status: "Ativo",
      role: "user",
      assistance_day: undefined,
      password: "senhaSegura",
    });
  });

  it("mapToUpdatePayload keeps only changed values and ignores empty password", () => {
    const payload = mapToUpdatePayload({
      ...baseFormValues,
      full_name: "  João da Silva  ",
      phone: "  ",
      password: "   ",
      social_network: "instagram.com/joao",
    });

    expect(payload).toEqual({
      full_name: "João da Silva",
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
      email: undefined,
      social_network: "instagram.com/joao",
      status: "Ativo",
      role: "user",
      assistance_day: null,
    });
  });

  it("mapToUpdatePayload returns undefined for empty full name", () => {
    const payload = mapToUpdatePayload({
      ...baseFormValues,
      full_name: "   ",
      password: "novaSenha123",
    });

    expect(payload.full_name).toBeUndefined();
    expect(payload.password).toBe("novaSenha123");
  });

  it("mapUserResponseToFormValues normalises nullable fields", () => {
    const user: UserResponse = {
      id: 1,
      full_name: "Carlos Souza",
      social_name: null,
      birth_date: null,
      cep: null,
      street: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
      phone: null,
      email: null,
      social_network: null,
      status: "Desativado",
      role: "admin",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: null,
    };

    const formValues = mapUserResponseToFormValues(user);

    expect(formValues).toMatchObject({
      full_name: "Carlos Souza",
      social_name: "",
      birth_date: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      phone: "",
      email: "",
      social_network: "",
      status: "Desativado",
      role: "admin",
      assistance_day: "",
      password: "",
      confirm_password: "",
    });
  });
});
