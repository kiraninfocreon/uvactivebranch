import { useEffect, useState } from "react";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { EmptyState } from "@/components/branch/EmptyState";
import { ConfirmActionDialog } from "@/components/branch/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Radio, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSensors, useCreateSensor, useUpdateSensor, useDeleteSensor, Sensor } from "@/hooks/branch/useSensors";
import { ApiError } from "@/lib/auth-context";

export default function Sensors() {
  const { data: sensors, isLoading } = useSensors();
  const deleteSensor = useDeleteSensor();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Sensor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sensor | null>(null);

  return (
    <BranchLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Sensors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your registered sensor straps — this count is what caps how many members a session can hold.
          </p>
        </div>
        <Button className="btn-cerise" onClick={() => setAddOpen(true)}>
          + Add Sensor
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading sensors…</div>
        ) : (sensors ?? []).length === 0 ? (
          <EmptyState icon={Radio} title="No sensors registered yet" actionLabel="+ Add Sensor" onAction={() => setAddOpen(true)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sensor ID</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sensors ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{s.sensorId}</TableCell>
                  <TableCell className="text-muted-foreground">{s.note || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditTarget(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SensorFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} />
      <SensorFormDialog mode="edit" sensor={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remove sensor "${deleteTarget?.name ?? ""}"?`}
        description="This lowers your available session capacity by one slot."
        confirmLabel="Remove"
        destructive
        loading={deleteSensor.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteSensor.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: (err) => {
              toast.error(err instanceof ApiError ? err.message : "Could not remove sensor.");
              setDeleteTarget(null);
            },
          });
        }}
      />
    </BranchLayout>
  );
}

function SensorFormDialog({
  mode,
  sensor,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  sensor?: Sensor | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const createSensor = useCreateSensor();
  const updateSensor = useUpdateSensor();
  const [name, setName] = useState("");
  const [sensorId, setSensorId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (mode === "edit" && sensor) {
      setName(sensor.name);
      setSensorId(sensor.sensorId);
      setNote(sensor.note ?? "");
    } else if (!open) {
      setName("");
      setSensorId("");
      setNote("");
    }
  }, [mode, sensor, open]);

  const loading = mode === "create" ? createSensor.isPending : updateSensor.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dto = { name, sensorId, note: note || undefined };
    if (mode === "create") {
      createSensor.mutate(dto, {
        onSuccess: () => {
          toast.success("Sensor added.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add sensor."),
      });
    } else if (sensor) {
      updateSensor.mutate(
        { id: sensor.id, dto },
        {
          onSuccess: () => {
            toast.success("Sensor updated.");
            onOpenChange(false);
          },
          onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update sensor."),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Sensor" : "Edit Sensor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sn-name">Sensor Name</Label>
            <Input id="sn-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sn-id">Sensor ID</Label>
            <Input id="sn-id" required value={sensorId} onChange={(e) => setSensorId(e.target.value)} placeholder="e.g. BLE MAC or strap serial" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sn-note">Note</Label>
            <Textarea id="sn-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full btn-cerise" disabled={loading}>
              {loading ? "Saving..." : mode === "create" ? "Add Sensor" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
