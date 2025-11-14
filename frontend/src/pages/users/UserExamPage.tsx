import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { getUser } from "../../api/users";
import { useAuth } from "../../auth/useAuth";
import {
  getExamRecord,
  updateExamRecord,
  type ExamRecordResponse,
  type ExamRecommendationValue,
  type ExamRecordUpdatePayload,
} from "../../api/exams";
import { fetchPassCycles, type PassCycle } from "../../api/passes";


const formatAge = (birthDate?: string | null): string => {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age} anos` : "—";
};

const formatAddress = (user: {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}): string => {
  const values = [
    user.street,
    user.number,
    user.complement,
    user.neighborhood,
    user.city,
    user.state,
    user.cep,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  if (values.length === 0) return "—";

  const [street, number, complement, neighborhood, city, state, cep] = values;
  const parts: string[] = [];
  if (street) {
    parts.push(number ? `${street}, ${number}` : street);
  }
  if (complement) {
    parts.push(complement);
  }
  if (neighborhood) {
    parts.push(neighborhood);
  }
  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) {
    parts.push(cityState);
  }
  if (cep) {
    parts.push(cep);
  }
  return parts.join(", ");
};

const RECOMMENDATIONS: { value: ExamRecommendationValue; label: string }[] = [
  { value: "evangelho_no_lar", label: "Evangelho no lar" },
  { value: "preces", label: "Preces" },
  { value: "leituras", label: "Leituras" },
  { value: "vigilancia", label: "Vigilância" },
  { value: "eae", label: "EAE" },
  { value: "trabalho", label: "Trabalho" },
  { value: "otimismo", label: "Otimismo" },
  { value: "confiar_em_jesus", label: "Confiar em Jesus" },
  { value: "sessao_doutrinaria", label: "Sessão doutrinária" },
];

interface ExamFormState {
  answers: string;
  observations: string;
  recommendations: Set<ExamRecommendationValue>;
}

const initializeState = (exam: ExamRecordResponse | null): ExamFormState => ({
  answers: exam?.answers ?? "",
  observations: exam?.observations ?? "",
  recommendations: new Set(exam?.recommendations ?? []),
});

const formatDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
};

const UserExamPage = () => {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const isValidId = Number.isInteger(userId) && userId > 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canEdit = session?.role === "exame" || session?.role === "admin";

  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const userQuery = useQuery({
    enabled: isValidId,
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    staleTime: 60_000,
  });

  const examQuery = useQuery({
    enabled: isValidId,
    queryKey: ["user", userId, "exam"],
    queryFn: () => getExamRecord(userId),
  });

  const passCyclesQuery = useQuery({
    enabled: isValidId,
    queryKey: ["user", userId, "pass-cycles"],
    queryFn: () => fetchPassCycles(userId),
    staleTime: 60_000,
  });

  const [formState, setFormState] = useState<ExamFormState>(() =>
    initializeState(null),
  );

  useEffect(() => {
    if (examQuery.data !== undefined) {
      setFormState(initializeState(examQuery.data));
    }
  }, [examQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({
      userId: targetUserId,
      payload,
    }: {
      userId: number;
      payload: ExamRecordUpdatePayload;
    }) => updateExamRecord(targetUserId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["user", userId, "exam"], data);
      setFormState(initializeState(data));
      setSnackbar({
        message: "Ficha de exame salva com sucesso.",
        severity: "success",
      });
    },
    onError: (error) => {
      const axiosError = error as AxiosError;
      const detail = (
        axiosError.response?.data as { detail?: string } | undefined
      )?.detail;
      setSnackbar({
        message: detail || axiosError.message || "Erro ao salvar a ficha.",
        severity: "error",
      });
    },
  });

  const isLoading =
    userQuery.isLoading || examQuery.isLoading || passCyclesQuery.isLoading;
  const isError = userQuery.isError || passCyclesQuery.isError;

  const handleChange =
    (field: keyof ExamFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleToggleRecommendation = (value: ExamRecommendationValue) => {
    setFormState((prev) => {
      const next = new Set(prev.recommendations);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...prev, recommendations: next };
    });
  };

  const handleSubmit = async () => {
    if (!canEdit) return;
    await updateMutation.mutateAsync({
      userId,
      payload: {
        answers: formState.answers.trim() || undefined,
        observations: formState.observations.trim() || undefined,
        recommendations: Array.from(formState.recommendations),
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const user = userQuery.data;
  const exam = examQuery.data;
  const cycles: PassCycle[] = passCyclesQuery.data ?? [];

  const examHistory = useMemo(() => {
    const entries = cycles
      .filter((c) => c.status === "Concluído")
      .map((c) => {
        const date =
          c.interview_completed_at ??
          c.interview_scheduled_for ??
          c.completed_at ??
          c.started_at;
        return {
          id: c.id,
          passType: c.pass_type,
          date,
        };
      })
      .filter((item) => item.date);

    return entries.sort((a, b) => {
      const da = new Date(a.date as string).getTime() || 0;
      const db = new Date(b.date as string).getTime() || 0;
      return db - da;
    });
  }, [cycles]);

  if (!isValidId) {
    return <Navigate to="/users" replace />;
  }

  if (isLoading) {
    return (
      <Stack spacing={3} alignItems="center" justifyContent="center">
        <CircularProgress />
        <Typography>Carregando ficha de exame...</Typography>
      </Stack>
    );
  }

  if (isError || !user) {
    const detail =
      ((userQuery.error as AxiosError | undefined)?.response?.data as
        | { detail?: string }
        | undefined)?.detail ||
      ((passCyclesQuery.error as AxiosError | undefined)?.response?.data as
        | { detail?: string }
        | undefined)?.detail;
    return (
      <Alert severity="error">
        {detail || "Não foi possível carregar o assistido."}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 960 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <div>
            <Typography variant="h5" component="h1">
              Ficha de exame
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Registre as respostas espirituais, observações e recomendações
              para o assistido.
            </Typography>
          </div>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button variant="outlined" onClick={handlePrint}>
              Imprimir ficha
            </Button>
            {/* Salvar movido para o canto inferior do card */}
          </Stack>
        </Stack>

        <Paper sx={{ p: { xs: 2, md: 4 }, position: "relative" }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Exames do assistido
              </Typography>
              {examHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum exame registrado para este assistido.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {examHistory.map((item) => (
                    <Typography key={item.id} variant="body2">
                      {formatDate(item.date)} — {item.passType}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>

            <Box>
              <Typography>ID: {user.id}</Typography>
              <Typography>Nome: {user.social_name || user.full_name}</Typography>
              <Typography>Idade: {formatAge(user.birth_date)}</Typography>
              <Typography>Endereço: {formatAddress(user)}</Typography>
            </Box>

            <TextField
              label="Descreva aqui as orientações coletadas no exame espiritual."
              value={formState.answers}
              onChange={handleChange("answers")}
              multiline
              minRows={6}
              placeholder="Descreva aqui as orientações coletadas no exame espiritual."
              disabled={!canEdit}
            />

            <TextField
              label="Observações dos entrevistadores"
              value={formState.observations}
              onChange={handleChange("observations")}
              multiline
              minRows={4}
              placeholder="Observações dos entrevistadores."
              disabled={!canEdit}
            />

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Recomendações
              </Typography>
              <FormGroup row sx={{ maxWidth: 600 }}>
                {RECOMMENDATIONS.map((item) => (
                  <FormControlLabel
                    key={item.value}
                    control={
                      <Checkbox
                        checked={formState.recommendations.has(item.value)}
                        onChange={() => handleToggleRecommendation(item.value)}
                        disabled={!canEdit}
                      />
                    }
                    label={item.label}
                  />
                ))}
              </FormGroup>
            </Box>

            {exam && (
              <Typography variant="caption" color="text.secondary">
                Última atualização em{" "}
                {new Date(exam.updated_at ?? exam.created_at).toLocaleString(
                  "pt-BR",
                )}
                .
              </Typography>
            )}
          </Stack>
          {canEdit && (
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="contained"
                disableElevation
                onClick={handleSubmit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {snackbar ? (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};

export default UserExamPage;
