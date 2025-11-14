import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { fetchExamToday, type ExamQueueItem } from "../api/exam_ops";

const ExamsTodayPage = () => {
  const [items, setItems] = useState<ExamQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExamToday();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const message = (e as Error)?.message || "Erro";
      setError(String(detail || message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Exames do dia
          </Typography>
          <Typography color="text.secondary">
            Lista de assistidos com presença hoje e exame pendente, para registro da ficha de exame.
          </Typography>
          <Box display="flex" gap={1}>
            <Button variant="outlined" onClick={load} disabled={loading}>
              Atualizar
            </Button>
            <Button variant="outlined" onClick={() => window.print()}>
              Imprimir
            </Button>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Agendado para</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.user_id}:${it.cycle_id}`}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.pass_type ?? ""}</TableCell>
                  <TableCell>{it.scheduled_for ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      component={RouterLink}
                      to={`/users/${it.user_id}/exam`}
                      variant="contained"
                    >
                      Abrir ficha
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">
                      Nenhum assistido com exame pendente para hoje.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ExamsTodayPage;

