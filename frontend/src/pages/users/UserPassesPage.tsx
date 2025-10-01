import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import QRCode from "react-qr-code";

import {
  fetchPassCycles,
  registerPassAbsence,
  registerPassPresence,
  type PassCycle,
} from "../../api/passes";
import { getUser, getUserQrData } from "../../api/users";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(iso),
  );
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
};

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

type DialogType = "presence" | "absence" | null;

interface DialogState {
  type: DialogType;
  date: string;
  notes: string;
}

const UserPassesPage = () => {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const isValidId = Number.isInteger(userId) && userId > 0;
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>({
    type: null,
    date: TODAY_ISO(),
    notes: "",
  });
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);
  const [showAllCycles, setShowAllCycles] = useState(false);

  const userQuery = useQuery({
    enabled: isValidId,
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    staleTime: 60_000,
  });

  const qrQuery = useQuery({
    enabled: isValidId && isQrDialogOpen,
    queryKey: ["user", userId, "qr"],
    queryFn: () => getUserQrData(userId),
    staleTime: 60_000,
  });

  const cyclesQuery = useQuery({
    enabled: isValidId,
    queryKey: ["pass-cycles", userId],
    queryFn: async () => {
      try {
        return await fetchPassCycles(userId);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
    staleTime: 30_000,
  });

  const presenceMutation = useMutation({
    mutationFn: (payload: { date: string; notes?: string }) =>
      registerPassPresence(userId, payload),
    onSuccess: () => {
      setSnackbar({
        message: "Presença registrada com sucesso.",
        severity: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["pass-cycles", userId] });
    },
    onError: (error) => {
      const axiosError = error as AxiosError;
      const detail = (
        axiosError.response?.data as { detail?: string } | undefined
      )?.detail;
      setSnackbar({
        message:
          detail ||
          axiosError.message ||
          "Não foi possível registrar a presença.",
        severity: "error",
      });
    },
  });

  const absenceMutation = useMutation({
    mutationFn: (payload: { date: string; notes?: string }) =>
      registerPassAbsence(userId, payload),
    onSuccess: () => {
      setSnackbar({
        message: "Ausência registrada com sucesso.",
        severity: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["pass-cycles", userId] });
    },
    onError: (error) => {
      const axiosError = error as AxiosError;
      const detail = (
        axiosError.response?.data as { detail?: string } | undefined
      )?.detail;
      setSnackbar({
        message:
          detail ||
          axiosError.message ||
          "Não foi possível registrar a ausência.",
        severity: "error",
      });
    },
  });

  const isLoading = userQuery.isLoading || cyclesQuery.isLoading;
  const isError = userQuery.isError || cyclesQuery.isError;

  const cycles: PassCycle[] = cyclesQuery.data ?? [];
  const activeCycle = cycles.find((cycle) => cycle.status === "Ativo") ?? null;
  const sortedActiveSessions = activeCycle
    ? [...activeCycle.sessions].sort((a, b) =>
        a.scheduled_for.localeCompare(b.scheduled_for),
      )
    : [];
  const historyCycles = cycles.filter((cycle) => cycle.status !== "Ativo");
  const visibleCycles = showAllCycles
    ? historyCycles
    : historyCycles.slice(0, 2);
  const canToggleCycles = historyCycles.length > 2;

  const openDialog = (type: DialogType) => {
    setDialogState({ type, date: TODAY_ISO(), notes: "" });
  };

  const closeDialog = () => {
    setDialogState((current) => ({ ...current, type: null }));
  };

  const handleDialogSubmit = async () => {
    if (!dialogState.type) return;
    const payload = {
      date: dialogState.date,
      notes: dialogState.notes.trim() || undefined,
    };

    try {
      if (dialogState.type === "presence") {
        await presenceMutation.mutateAsync(payload);
      } else {
        await absenceMutation.mutateAsync(payload);
      }
      closeDialog();
    } catch {
      // handled on mutation onError
    }
  };

  if (!isValidId) {
    return <Navigate to="/users" replace />;
  }

  if (isLoading) {
    return (
      <Stack spacing={3} alignItems="center" justifyContent="center">
        <CircularProgress />
        <Typography>Carregando informações do assistido...</Typography>
      </Stack>
    );
  }

  if (isError || !userQuery.data) {
    const error = (userQuery.error ?? cyclesQuery.error) as
      | AxiosError
      | undefined;
    const detail = (error?.response?.data as { detail?: string } | undefined)
      ?.detail;
    return (
      <Alert severity="error">
        {detail ||
          error?.message ||
          "Não foi possível carregar as informações de passes."}
      </Alert>
    );
  }

  const user = userQuery.data;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 1200 }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
          sx={{ flexWrap: "wrap", gap: 2 }}
        >
          <Box>
            <Typography variant="h5" component="h1">
              Controle de passes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Acompanhe a sequência semanal de passes e registre presenças ou
              ausências do assistido.
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              Assistido: {user.full_name}
            </Typography>
            {user.assistance_day && (
              <Typography variant="body2" color="text.secondary">
                Dia de assistência: {user.assistance_day}
              </Typography>
            )}
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              flexWrap: "wrap",
              justifyContent: { xs: "flex-start", md: "flex-end" },
            }}
          >
            <Button
              variant="contained"
              disableElevation
              onClick={() => openDialog("presence")}
              disabled={presenceMutation.isPending || absenceMutation.isPending}
            >
              Registrar presença
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => openDialog("absence")}
              disabled={presenceMutation.isPending || absenceMutation.isPending}
            >
              Registrar ausência
            </Button>
            <Button
              variant="outlined"
              onClick={() => setQrDialogOpen(true)}
              disabled={qrQuery.isFetching}
            >
              Exibir QR code
            </Button>
          </Stack>
        </Stack>

        {activeCycle ? (
          <Card sx={{ width: "100%" }}>
            <CardHeader
              title={`Ciclo ativo — ${activeCycle.pass_type}`}
              subheader={`Iniciado em ${formatDate(activeCycle.started_at)} • Etapa ${activeCycle.stage_number} de ${activeCycle.sequence_length}`}
              action={
                <IconButton
                  aria-label="Atualizar"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["pass-cycles", userId],
                    })
                  }
                  disabled={cyclesQuery.isFetching}
                >
                  <RefreshIcon />
                </IconButton>
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status: {activeCycle.status}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Presenças registradas:{" "}
                    {
                      activeCycle.sessions.filter(
                        (session) => session.status === "Presente",
                      ).length
                    }{" "}
                    /{activeCycle.sequence_length}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer sx={{ mt: 2 }}>
                <Table size="small" sx={{ tableLayout: "auto", width: "100%" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        #
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        Data
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        Registrado em
                      </TableCell>
                      <TableCell
                        sx={{
                          whiteSpace: "nowrap",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Observações
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedActiveSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Nenhuma presença ou ausência registrada neste ciclo.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedActiveSessions.map((session, index) => (
                        <TableRow key={session.id}>
                          <TableCell
                            sx={{ whiteSpace: "nowrap", textAlign: "center" }}
                          >
                            {index + 1}
                          </TableCell>
                          <TableCell
                            sx={{ whiteSpace: "nowrap", textAlign: "center" }}
                          >
                            {formatDate(session.scheduled_for)}
                          </TableCell>
                          <TableCell
                            sx={{ whiteSpace: "nowrap", textAlign: "center" }}
                          >
                            {session.status}
                          </TableCell>
                          <TableCell
                            sx={{ whiteSpace: "nowrap", textAlign: "center" }}
                          >
                            {formatDateTime(session.presence_recorded_at)}
                          </TableCell>
                          <TableCell
                            sx={{ whiteSpace: "nowrap", textAlign: "left" }}
                          >
                            {session.notes ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info">
            Nenhum ciclo ativo encontrado para este assistido.
          </Alert>
        )}

        {historyCycles.length > 0 && (
          <Stack spacing={2}>
            <Typography variant="h6">Histórico de ciclos</Typography>
            {visibleCycles.map((cycle) => {
              const sortedSessions = [...cycle.sessions].sort((a, b) =>
                a.scheduled_for.localeCompare(b.scheduled_for),
              );

              return (
                <Card
                  key={cycle.id}
                  sx={{ width: "100%" }}
                  variant={cycle.status === "Ativo" ? "outlined" : undefined}
                >
                  <CardHeader
                    title={`${cycle.pass_type} — ${cycle.status}`}
                    subheader={`Início: ${formatDate(cycle.started_at)} • Término: ${formatDate(cycle.completed_at)}`}
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Etapa: {cycle.stage_number}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Entrevista necessária:{" "}
                          {cycle.requires_interview ? "Sim" : "Não"}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Entrevista agendada para:{" "}
                          {formatDate(cycle.interview_scheduled_for)}
                        </Typography>
                      </Grid>
                    </Grid>

                    {sortedSessions.length > 0 && (
                      <TableContainer sx={{ mt: 2 }}>
                        <Table
                          size="small"
                          sx={{ tableLayout: "auto", width: "100%" }}
                        >
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  fontWeight: 600,
                                }}
                              >
                                #
                              </TableCell>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  fontWeight: 600,
                                }}
                              >
                                Data
                              </TableCell>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  fontWeight: 600,
                                }}
                              >
                                Status
                              </TableCell>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  fontWeight: 600,
                                }}
                              >
                                Registrado em
                              </TableCell>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  textAlign: "left",
                                  fontWeight: 600,
                                }}
                              >
                                Observações
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedSessions.map((session, index) => (
                              <TableRow key={session.id}>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    textAlign: "center",
                                  }}
                                >
                                  {index + 1}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    textAlign: "center",
                                  }}
                                >
                                  {formatDate(session.scheduled_for)}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    textAlign: "center",
                                  }}
                                >
                                  {session.status}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    textAlign: "center",
                                  }}
                                >
                                  {formatDateTime(session.presence_recorded_at)}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    textAlign: "left",
                                  }}
                                >
                                  {session.notes ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {canToggleCycles && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowAllCycles((prev) => !prev)}
                >
                  {showAllCycles ? "Ver menos ciclos" : "Ver todos os ciclos"}
                </Button>
              </Box>
            )}
          </Stack>
        )}

        <Dialog
          open={dialogState.type !== null}
          onClose={closeDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {dialogState.type === "presence"
              ? "Registrar presença"
              : "Registrar ausência"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Informe a data de referência e, sempre que necessário, adicione
              observações.
            </DialogContentText>
            <Stack spacing={2}>
              <TextField
                label="Data"
                type="date"
                value={dialogState.date}
                onChange={(event) =>
                  setDialogState((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Observações"
                value={dialogState.notes}
                onChange={(event) =>
                  setDialogState((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                minRows={2}
                multiline
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeDialog}
              disabled={presenceMutation.isPending || absenceMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDialogSubmit}
              variant="contained"
              disableElevation
              disabled={presenceMutation.isPending || absenceMutation.isPending}
            >
              {dialogState.type === "presence"
                ? "Salvar presença"
                : "Salvar ausência"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isQrDialogOpen}
          onClose={() => setQrDialogOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>QR code do assistido</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Utilize este código para registrar a presença do assistido por
              leitura automática.
            </DialogContentText>
            <Stack spacing={2} alignItems="center">
              {qrQuery.isLoading ? (
                <CircularProgress />
              ) : qrQuery.isError ? (
                <Alert severity="error" sx={{ width: "100%" }}>
                  Não foi possível carregar o QR code.
                </Alert>
              ) : qrQuery.data ? (
                <>
                  <QRCode value={JSON.stringify(qrQuery.data)} size={180} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    align="center"
                  >
                    {qrQuery.data.name}
                  </Typography>
                </>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQrDialogOpen(false)}>Fechar</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(snackbar)}
          autoHideDuration={4000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          {snackbar && (
            <Alert
              onClose={() => setSnackbar(null)}
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

export default UserPassesPage;
