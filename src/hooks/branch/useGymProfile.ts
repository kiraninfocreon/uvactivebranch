import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GymProfile } from "@/lib/types";

const KEY = ["branch", "gym"];

export function useGymProfile() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<GymProfile>("/branch/gym")).data,
  });
}

// Deliberately no managerEmail/managerPhone here — those are admin-only
// (spec: "not the email id of manager and phone number — cannot get
// changed, only by admin can do"). Manager NAME goes through the
// separate useUpdateManagerName mutation below since it lives on a
// different backend endpoint (the Trainer row, not the Gym row).
export interface UpdateGymProfileInput {
  name?: string;
  address?: string;
  location?: string;
  gymPhone?: string;
  ownerContact?: string;
  contactEmail?: string;
  logoUrl?: string;
}

export function useUpdateGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateGymProfileInput) => (await api.patch<GymProfile>("/branch/gym", dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateManagerName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.patch("/branch/gym/manager-name", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
