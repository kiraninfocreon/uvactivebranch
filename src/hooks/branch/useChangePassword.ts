import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Authenticated "change my own password" — distinct from the logged-out
// forgot-password/OTP flow already on the login screen. NOT YET BACKED
// by the cloud API (no /auth/staff/change-password route exists as of
// this audit) — see audit report, Settings section.
export function useChangePassword() {
  return useMutation({
    mutationFn: async (dto: ChangePasswordInput) =>
      (await api.post("/auth/staff/change-password", dto)).data,
  });
}
