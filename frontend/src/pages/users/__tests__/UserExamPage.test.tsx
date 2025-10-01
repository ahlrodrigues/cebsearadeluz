import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import UserExamPage from "../UserExamPage";

vi.mock("../../../api/users", () => ({
  getUser: vi.fn(() =>
    Promise.resolve({
      id: 1,
      full_name: "Joana Teste",
      social_name: "Jo",
      status: "Ativo",
      assistance_day: "Segunda-feira",
      birth_date: "1990-05-10",
      street: "Rua Teste",
      number: "123",
      complement: "Apto 12",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      cep: "12345-678",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: null,
    }),
  ),
}));

const mockGetExamRecord = vi.fn();
const mockUpdateExamRecord = vi.fn();

vi.mock("../../../api/exams", () => ({
  getExamRecord: (...args: unknown[]) => mockGetExamRecord(...args),
  updateExamRecord: (...args: unknown[]) => mockUpdateExamRecord(...args),
}));

let dateNowSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeAll(() => {
  dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(
    new Date('2024-05-15T00:00:00Z').getTime(),
  );
});

afterAll(() => {
  dateNowSpy?.mockRestore();
});

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  mockGetExamRecord.mockResolvedValue({
    id: 10,
    user_id: 1,
    answers: "Resposta",
    observations: "Obs",
    recommendations: ["preces"],
    created_at: "2024-05-01T10:00:00Z",
    updated_at: "2024-05-02T10:00:00Z",
  });
  mockUpdateExamRecord.mockResolvedValue({
    id: 10,
    user_id: 1,
    answers: "Resposta atualizada",
    observations: "Obs",
    recommendations: ["preces"],
    created_at: "2024-05-01T10:00:00Z",
    updated_at: "2024-05-02T10:05:00Z",
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/users/1/exam"]}>
        <Routes>
          <Route path="/users/:userId/exam" element={<UserExamPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("UserExamPage", () => {
  it("shows data and allows saving", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Ficha de exame")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Resposta")).toBeInTheDocument();
    expect(screen.getByText(/ID: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Nome: Jo/)).toBeInTheDocument();
    expect(screen.getByText(/Endereço:/)).toHaveTextContent('Endereço: Rua Teste, 123, Apto 12, Centro, São Paulo - SP, 12345-678');
    const expectedAge = (() => {
      const birth = new Date('1990-05-10');
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
      }
      return `${age} anos`;
    })();
    expect(screen.getByText(/Idade:/)).toHaveTextContent(`Idade: ${expectedAge}`);
    expect(screen.getByText(/Endereço:/)).toHaveTextContent(/Rua Teste, 123, Apto 12, Centro, São Paulo - SP, 12345-678/);
    expect(screen.getByLabelText(/Preces/i)).toBeChecked();

    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/Respostas do exame/i));
    await user.type(
      screen.getByLabelText(/Respostas do exame/i),
      "Resposta atualizada",
    );

    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => expect(mockUpdateExamRecord).toHaveBeenCalled());
    expect(mockUpdateExamRecord).toHaveBeenCalledWith(1, {
      answers: "Resposta atualizada",
      observations: "Obs",
      recommendations: ["preces"],
    });
  });

  it("handles exam when not found and creates on save", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockGetExamRecord.mockResolvedValueOnce(null);
    mockUpdateExamRecord.mockResolvedValue({
      id: 99,
      user_id: 1,
      answers: "",
      observations: "",
      recommendations: [],
      created_at: "2024-05-01T10:00:00Z",
      updated_at: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/users/1/exam"]}>
          <Routes>
            <Route path="/users/:userId/exam" element={<UserExamPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Ficha de exame")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Respostas do exame/i)).toHaveValue("");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Observações/i), "Nova observação");
    await user.click(screen.getByLabelText(/Evangelho no lar/i));
    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => expect(mockUpdateExamRecord).toHaveBeenCalled());
    expect(mockUpdateExamRecord).toHaveBeenCalledWith(1, {
      answers: undefined,
      observations: "Nova observação",
      recommendations: ["evangelho_no_lar"],
    });
  });
});
