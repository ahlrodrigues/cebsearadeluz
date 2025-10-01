import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Link,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import { AxiosError } from "axios";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import Snackbar from "@mui/material/Snackbar";

import { deleteUser, fetchUsers } from "../../api/users";
import type {
  UserFilters,
  UserResponse,
  UserRole,
  UserStatus,
  AssistanceDay,
} from "../../api/users";

const statusFilterOptions: Array<{ value: "all" | UserStatus; label: string }> =
  [
    { value: "all", label: "Todos" },
    { value: "Ativo", label: "Ativo" },
    { value: "Desativado", label: "Desativado" },
  ];

const roleFilterOptions: Array<{ value: "all" | UserRole; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "user", label: "Assistido" },
  { value: "admin", label: "Administrador" },
];

const assistanceDayOptions: Array<{
  value: "all" | AssistanceDay;
  label: string;
}> = [
  { value: "all", label: "Todos os dias" },
  { value: "Segunda-feira", label: "Segunda-feira" },
  { value: "Terça-feira", label: "Terça-feira" },
  { value: "Quarta-feira", label: "Quarta-feira" },
  { value: "Quinta-feira", label: "Quinta-feira" },
  { value: "Sexta-feira", label: "Sexta-feira" },
  { value: "Sábado", label: "Sábado" },
  { value: "Domingo", label: "Domingo" },
];

type FilterState = {
  search: string;
  status: "all" | UserStatus;
  role: "all" | UserRole;
  assistance_day: "all" | AssistanceDay;
};

const FILTERS_INITIAL_STATE: FilterState = {
  search: "",
  status: "all",
  role: "all",
  assistance_day: "all",
};

const mapToApiFilters = (filters: FilterState): UserFilters => ({
  search: filters.search.trim() || undefined,
  status: filters.status === "all" ? undefined : filters.status,
  role: filters.role === "all" ? undefined : filters.role,
  assistance_day:
    filters.assistance_day === "all" ? undefined : filters.assistance_day,
});

const formatDate = (isoDate?: string | null) => {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(isoDate),
  );
};

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoDate));

const UserListPage = () => {
  const [filters, setFilters] = useState<FilterState>(FILTERS_INITIAL_STATE);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(
    FILTERS_INITIAL_STATE,
  );
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const queryFilters = useMemo(
    () => mapToApiFilters(appliedFilters),
    [appliedFilters],
  );

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<
    UserResponse[],
    AxiosError
  >({
    queryKey: ["users", queryFilters],
    queryFn: () => fetchUsers(queryFilters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      setSnackbar({
        message: "Assistido removido com sucesso.",
        severity: "success",
      });
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (mutationError: unknown) => {
      const axiosError = mutationError as AxiosError | undefined;
      const message =
        (axiosError?.response?.data as { detail?: string } | undefined)
          ?.detail ||
        axiosError?.message ||
        "Não foi possível remover o assistido.";
      setSnackbar({ message, severity: "error" });
    },
  });

  const handleFilterChange =
    (field: keyof FilterState) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value as FilterState[keyof FilterState];
      setFilters((current) => ({ ...current, [field]: value }));
    };

  const handleSubmitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setFilters(FILTERS_INITIAL_STATE);
    setAppliedFilters(FILTERS_INITIAL_STATE);
  };

  const users: UserResponse[] = data ?? [];
  const apiErrorDetail = (
    error?.response?.data as { detail?: string } | undefined
  )?.detail;

  const handleCloseSnackbar = () => setSnackbar(null);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync(userToDelete.id);
    } catch {
      // erro tratado em onError
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 1200 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
        >
          <div>
            <Typography variant="h5" component="h1">
              Cadastro de assistidos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Utilize os filtros para localizar rapidamente assistidos ativos,
              inativos ou administradores.
            </Typography>
          </div>
        </Stack>

        <Paper
          component="form"
          onSubmit={handleSubmitFilters}
          sx={{ p: 3, width: "100%" }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent={{ xs: "center", md: "center" }}
            sx={{
              flexWrap: { md: "wrap" },
              rowGap: 2,
              columnGap: 2,
              textAlign: { xs: "left", md: "center" },
            }}
          >
            <TextField
              label="Buscar por nome"
              value={filters.search}
              onChange={handleFilterChange("search")}
              placeholder="Digite parte do nome"
              fullWidth
              sx={{ flexGrow: { md: 1 }, minWidth: { md: 260 } }}
            />

            <TextField
              select
              label="Status"
              value={filters.status}
              onChange={handleFilterChange("status")}
              sx={{
                minWidth: { xs: "100%", md: 180 },
                flexBasis: { md: 180 },
                flexGrow: { md: 0 },
              }}
            >
              {statusFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Perfil"
              value={filters.role}
              onChange={handleFilterChange("role")}
              sx={{
                minWidth: { xs: "100%", md: 200 },
                flexBasis: { md: 200 },
                flexGrow: { md: 0 },
              }}
            >
              {roleFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Dia de assistência"
              value={filters.assistance_day}
              onChange={handleFilterChange("assistance_day")}
              sx={{
                minWidth: { xs: "100%", md: 220 },
                flexBasis: { md: 220 },
                flexGrow: { md: 0 },
              }}
            >
              {assistanceDayOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexShrink: 0,
                flexWrap: "wrap",
                justifyContent: { xs: "center", md: "center" },
              }}
            >
              <Button
                type="submit"
                variant="contained"
                disableElevation
                disabled={isFetching && !isError}
              >
                Aplicar filtros
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleClearFilters}
                disabled={isFetching}
              >
                Limpar
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiErrorDetail ??
              error?.message ??
              "Não foi possível carregar os assistidos."}
            <Box>
              <Link
                component="button"
                type="button"
                onClick={() => refetch()}
                sx={{ mt: 1 }}
              >
                Tentar novamente
              </Link>
            </Box>
          </Alert>
        )}

        <Paper sx={{ display: "block", width: "100%", mt: 3 }}>
          {isLoading || isFetching ? <LinearProgress /> : <Divider />}
          <Table size="medium" sx={{ tableLayout: "auto", width: "100%" }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 180,
                    px: 1.5,
                  }}
                >
                  Nome
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 200,
                    px: 1.5,
                  }}
                >
                  Email
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 110,
                    px: 1.5,
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 120,
                    px: 1.5,
                  }}
                >
                  Perfil
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 140,
                    px: 1.5,
                  }}
                >
                  Dia de assistência
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 140,
                    px: 1.5,
                  }}
                >
                  Cadastro
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    minWidth: 140,
                    px: 1.5,
                  }}
                >
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum assistido encontrado com os filtros selecionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const displayName = user.social_name ?? user.full_name;
                  const secondaryName = user.social_name
                    ? user.full_name
                    : null;
                  const activeCycleLabel = user.has_active_cycle
                    ? `${user.active_cycle_pass_type ?? "Ciclo ativo"} • ${
                        user.active_cycle_stage_number ?? "-"
                      }/${user.active_cycle_sequence_length ?? "-"}`
                    : null;
                  const nextSessionLabel = user.active_cycle_next_session
                    ? `Próx. atendimento: ${formatDate(
                        user.active_cycle_next_session,
                      )}`
                    : null;
                  const interviewLabel = user.active_cycle_requires_interview
                    ? user.active_cycle_interview_scheduled_for
                      ? `Entrevista: ${formatDate(
                          user.active_cycle_interview_scheduled_for,
                        )}`
                      : "Entrevista pendente"
                    : null;

                  return (
                    <TableRow key={user.id} hover>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "left",
                          px: 1.5,
                        }}
                        title={displayName}
                      >
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Typography variant="subtitle2" noWrap>
                            {displayName}
                          </Typography>
                          {secondaryName && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              title={`Nome civil: ${secondaryName}`}
                            >
                              Nome civil: {secondaryName}
                            </Typography>
                          )}
                          {(activeCycleLabel ||
                            nextSessionLabel ||
                            interviewLabel) && (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              flexWrap="wrap"
                            >
                              {activeCycleLabel && (
                                <Chip
                                  size="small"
                                  color="primary"
                                  label={activeCycleLabel}
                                  sx={{ mt: 0.25 }}
                                />
                              )}
                              {nextSessionLabel && (
                                <Chip
                                  size="small"
                                  color="info"
                                  label={nextSessionLabel}
                                  sx={{ mt: 0.25 }}
                                />
                              )}
                              {interviewLabel && (
                                <Chip
                                  size="small"
                                  color={
                                    user.active_cycle_interview_scheduled_for
                                      ? "warning"
                                      : "default"
                                  }
                                  label={interviewLabel}
                                  sx={{ mt: 0.25 }}
                                />
                              )}
                            </Stack>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "left",
                          px: 1.5,
                        }}
                        title={user.email ?? undefined}
                      >
                        {user.email ?? "—"}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          px: 1.5,
                        }}
                      >
                        <Chip
                          label={user.status}
                          color={
                            user.status === "Ativo" ? "success" : "default"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          px: 1.5,
                        }}
                      >
                        <Chip
                          label={
                            user.role === "admin"
                              ? "Administrador"
                              : "Assistido"
                          }
                          color={user.role === "admin" ? "primary" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          px: 1.5,
                        }}
                      >
                        {user.assistance_day ?? "—"}
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          px: 1.5,
                        }}
                      >
                        {formatDateTime(user.created_at)}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ whiteSpace: "nowrap", px: 1.5 }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Tooltip title="Ficha de exame">
                            <span>
                              <IconButton
                                size="small"
                                color="default"
                                onClick={() =>
                                  navigate(`/users/${user.id}/exam`)
                                }
                              >
                                <DescriptionIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Controle de passes">
                            <span>
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={() =>
                                  navigate(`/users/${user.id}/passes`)
                                }
                              >
                                <EventAvailableIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  navigate(`/users/${user.id}/edit`)
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setUserToDelete(user)}
                                disabled={deleteMutation.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>

        <Dialog
          open={Boolean(userToDelete)}
          onClose={() =>
            deleteMutation.isPending ? undefined : setUserToDelete(null)
          }
          aria-labelledby="confirm-delete-title"
        >
          <DialogTitle id="confirm-delete-title">
            Confirmar exclusão
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Tem certeza de que deseja remover{" "}
              <strong>
                {userToDelete?.social_name ?? userToDelete?.full_name}
              </strong>
              ? Essa ação não pode ser desfeita.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setUserToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              color="error"
              variant="contained"
              disableElevation
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Excluir"}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(snackbar)}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          {snackbar && (
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              variant="filled"
            >
              {snackbar.message}
            </Alert>
          )}
        </Snackbar>
      </Stack>
    </Box>
  );
};

export default UserListPage;
