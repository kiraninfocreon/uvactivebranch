import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TransferRequest } from "@/lib/types";

const KEY = ["branch", "transfer-requests"];

export function useTransferRequests() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<TransferRequest[]>("/branch/transfer-requests")).data,
  });
}

export function useSendTransferRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => (await api.post<TransferRequest>("/branch/transfer-requests", { memberId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAcceptTransferRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<TransferRequest>(`/branch/transfer-requests/${id}/accept`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeclineTransferRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<TransferRequest>(`/branch/transfer-requests/${id}/decline`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
