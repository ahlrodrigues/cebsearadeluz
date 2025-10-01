import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import UserPassesPage from "../UserPassesPage";

vi.mock("../../../api/users", () => ({
  getUser: vi.fn(() =>
    Promise.resolve({
      id: 1,
      full_name: "Joana Teste",
      status: "Ativo",
      role: "user",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: null,
      assistance_day: "Segunda-feira",
      has_active_cycle: true,
      active_cycle_pass_type: "P1",
      active_cycle_stage_number: 1,
      active_cycle_sequence_length: 4,
      active_cycle_presence_count: 1,
      active_cycle_absence_count: 0,
      active_cycle_next_session: "2024-05-08",
      active_cycle_requires_interview: false,
      active_cycle_interview_scheduled_for: null,
      active_cycle_last_presence_recorded_at: "2024-05-01T10:05:00Z",
    }),
  ),
  getUserQrData: vi.fn(() => Promise.resolve({ id: 1, name: "Jo" })),
}));

vi.mock("../../../api/passes", () => ({
  fetchPassCycles: vi.fn(() =>
    Promise.resolve([
      {
        id: 10,
        user_id: 1,
        stage_number: 1,
        pass_type: "P1",
        status: "Ativo",
        sequence_length: 4,
        started_at: "2024-05-01",
        completed_at: null,
        interrupted_at: null,
        requires_interview: false,
        interview_scheduled_for: null,
        interview_completed_at: null,
        created_at: "2024-05-01T10:00:00Z",
        updated_at: null,
        sessions: [
          {
            id: 101,
            cycle_id: 10,
            sequence_index: 1,
            scheduled_for: "2024-05-01",
            status: "Presente",
            notes: null,
            presence_recorded_at: "2024-05-01T10:05:00Z",
            created_at: "2024-05-01T10:05:00Z",
            updated_at: null,
          },
        ],
      },
    ]),
  ),
  registerPassPresence: vi.fn(),
  registerPassAbsence: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/users/1/passes"]}>
        <Routes>
          <Route path="/users/:userId/passes" element={<UserPassesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { queryClient, ...result };
};

describe("UserPassesPage", () => {
  it("renders active cycle and actions", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Controle de passes")).toBeInTheDocument(),
    );
    expect(screen.getByText("Assistido: Joana Teste")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrar presença/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Registrar ausência/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Exibir QR code/i }),
    ).toBeEnabled();
    expect(
      screen.getAllByRole("cell", { name: "Presente" }).length,
    ).toBeGreaterThan(0);
  });
});
