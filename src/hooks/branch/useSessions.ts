import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HrTick, Session } from "@/lib/types";

const KEY = ["branch", "sessions"];

// Per-second BPM history for one member within one completed session —
// powers the leaderboard -> member drill-down graph. Backed by
// GET /branch/sessions/:id/athlete/:memberId/ticks.
export function useSessionAthleteTicks(sessionId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, sessionId, "athlete", memberId, "ticks"],
    queryFn: async () =>
      (await api.get<{ ticks: HrTick[] }>(`/branch/sessions/${sessionId}/athlete/${memberId}/ticks`)).data,
    enabled: !!sessionId && !!memberId,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Session[]>("/branch/sessions")).data,
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => (await api.get<Session>(`/branch/sessions/${id}`)).data,
    enabled: !!id,
  });
}

export interface CreateSessionInput {
  name: string;
  trainerId: string;
  // No capacity field — it's always derived server-side from the gym's
  // registered sensor count (see backend SessionsService.create).
  scheduledAt: string;
  scheduledEndAt?: string;
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateSessionInput) => (await api.post<Session>("/branch/sessions", dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEnrollMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, memberId }: { sessionId: string; memberId: string }) =>
      (await api.post(`/branch/sessions/${sessionId}/members`, { memberId })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.sessionId] });
    },
  });
}

export function useCancelSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/branch/sessions/${id}/cancel`, { reason })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useReassignSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, trainerId }: { id: string; trainerId: string }) =>
      (await api.post(`/branch/sessions/${id}/reassign/${trainerId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["branch", "dashboard"] });
    },
  });
}
