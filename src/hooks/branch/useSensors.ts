import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Sensor {
  id: string;
  gymId: string;
  name: string;
  sensorId: string;
  note?: string | null;
  createdAt: string;
}

const KEY = ["branch", "sensors"];

export function useSensors() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Sensor[]>("/branch/sensors")).data,
  });
}

export interface SensorInput {
  name: string;
  sensorId: string;
  note?: string;
}

export function useCreateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: SensorInput) => (await api.post<Sensor>("/branch/sensors", dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<SensorInput> }) =>
      (await api.patch<Sensor>(`/branch/sensors/${id}`, dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/branch/sensors/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
