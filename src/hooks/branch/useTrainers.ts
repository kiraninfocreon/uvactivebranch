import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trainer } from "@/lib/types";

const KEY = ["branch", "trainers"];

export function useTrainers() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Trainer[]>("/branch/trainers")).data,
  });
}

// No `role` field — a branch manager creates trainers here, full stop.
// Branch managers are provisioned exactly once, alongside their gym
// (GymsService.create); this endpoint's DTO has no role field at all,
// and the app's global forbidNonWhitelisted validation rejects the
// request outright if one is sent — not silently ignored.
export interface CreateTrainerInput {
  name: string;
  email: string;
  phone: string;
}

export interface CreateTrainerResult extends Trainer {
  temporaryPassword: string;
}

export function useCreateTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateTrainerInput) => (await api.post<CreateTrainerResult>("/branch/trainers", dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface UpdateTrainerInput {
  name?: string;
  phone?: string;
}

export function useUpdateTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateTrainerInput }) =>
      (await api.patch<Trainer>(`/branch/trainers/${id}`, dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/branch/trainers/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetTrainerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      (await api.post(`/branch/trainers/${id}/${active ? "activate" : "suspend"}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface ResetTrainerPasswordResult {
  trainerId: string;
  email: string;
  temporaryPassword: string;
}

export function useResetTrainerPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<ResetTrainerPasswordResult>(`/branch/trainers/${id}/reset-password`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
