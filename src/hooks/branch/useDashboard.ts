import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Session } from "@/lib/types";

export interface BranchDashboard {
  memberCount: number;
  memberLimit: number;
  sessionsToday: Session[];
  pendingTransferCount: number;
  needsReassignment: Session[];
  trainerCount: number;
  sensorCount: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["branch", "dashboard"],
    queryFn: async () => (await api.get<BranchDashboard>("/branch/dashboard")).data,
  });
}
