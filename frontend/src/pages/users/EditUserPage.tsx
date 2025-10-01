import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";

import { getUser, updateUser, type UpdateUserPayload } from "../../api/users";
import { UserForm, mapUserResponseToFormValues } from "../../components/users";

const EditUserPage = () => {
  const params = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userId = Number(params.userId);
  const isValidId = Number.isInteger(userId) && userId > 0;

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    enabled: isValidId,
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(userId, payload),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["user", userId], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const initialValues = useMemo(
    () => (user ? mapUserResponseToFormValues(user) : undefined),
    [user],
  );

  if (!isValidId) {
    return <Navigate to="/users" replace />;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 960 }}>
          <Stack spacing={2}>
            <Typography variant="h6">
              Carregando dados do assistido...
            </Typography>
            <LinearProgress />
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (isError || !user) {
    const apiError = error as AxiosError | undefined;
    return (
      <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 960 }}>
          <Stack spacing={3}>
            <Alert severity="error">
              {apiError?.response?.status === 404
                ? "Assistido não encontrado."
                : (apiError?.message ??
                  "Não foi possível carregar o assistido.")}
            </Alert>
            <Box>
              <Button variant="outlined" onClick={() => navigate("/users")}>
                Voltar para a lista
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 960 }}>
        <UserForm
          mode="edit"
          title="Atualização de assistido"
          subtitle="Revise as informações e salve para atualizar o cadastro."
          submitLabel="Salvar alterações"
          successMessage="Dados atualizados com sucesso!"
          initialValues={initialValues}
          isSubmitting={updateMutation.isPending}
          error={(updateMutation.error as AxiosError | Error | null) ?? null}
          onSubmit={async (values) => {
            await updateMutation.mutateAsync(values);
          }}
          onReset={() => {
            queryClient.invalidateQueries({ queryKey: ["user", userId] });
          }}
        />
      </Stack>
    </Box>
  );
};

export default EditUserPage;
