import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Member, MemberProfile, PlatformMemberSearchResult, Sex } from "@/lib/types";

const KEY = ["branch", "members"];

export function useMembers() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Member[]>("/branch/members")).data,
  });
}

// Full detail screen for one member: bio + every session they've done +
// per-session stats, for the "click member -> see full stat/graph view"
// flow. NOT YET BACKED by the cloud API — see audit report, Member Detail
// section.
export function useMemberProfile(memberId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, memberId, "profile"],
    queryFn: async () => (await api.get<MemberProfile>(`/branch/members/${memberId}/profile`)).data,
    enabled: !!memberId,
  });
}

export interface RegisterMemberInput {
  name: string;
  phone: string;
  email: string;
  consentVersion: string;
  consentAccepted: boolean;
  ageYears: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  restingHr: number;
}

export function useRegisterMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: RegisterMemberInput) => (await api.post<Member>("/branch/members", dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReleaseMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await api.post(`/branch/members/${id}/release`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface UpdateMemberInput {
  name?: string;
  phone?: string;
  email?: string;
  sex?: Sex;
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  restingHr?: number;
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateMemberInput }) =>
      (await api.patch<Member>(`/branch/members/${id}`, dto)).data,
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id, "profile"] });
    },
  });
}

export function useResetMemberPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<{ ok: boolean; plainPin: string }>(`/branch/members/${id}/reset-pin`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Platform-wide exact-ID lookup, for the "search by ID / QR scan" panel. Never a broad name search. */
export function useSearchMemberByCode() {
  return useMutation({
    mutationFn: async (code: string) => (await api.get<PlatformMemberSearchResult>("/branch/members/search", { code })).data,
  });
}
