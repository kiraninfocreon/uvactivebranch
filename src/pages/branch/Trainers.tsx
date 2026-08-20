import { useEffect, useState } from "react";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { EmptyState } from "@/components/branch/EmptyState";
import { ConfirmActionDialog } from "@/components/branch/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Dumbbell, CheckCircle2, Pencil, Trash2, KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useTrainers, useCreateTrainer, useUpdateTrainer, useDeleteTrainer, useSetTrainerStatus, useResetTrainerPassword,
  CreateTrainerResult,
} from "@/hooks/branch/useTrainers";
import { ApiError } from "@/lib/auth-context";
import { Trainer } from "@/lib/types";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// Same phone-number rule used across the branch portal's other forms.
function validatePhone(value: string): string {
  const digits = value.replace(/[\s\-()+]/g, "");
  return /^\d{10,15}$/.test(digits) ? "" : "Enter a valid phone number (10–15 digits).";
}

export default function Trainers() {
  const { data: trainers, isLoading } = useTrainers();
  const setStatus = useSetTrainerStatus();
  const deleteTrainer = useDeleteTrainer();
  const resetPassword = useResetTrainerPassword();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Trainer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trainer | null>(null);
  const [resetTarget, setResetTarget] = useState<Trainer | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<Trainer | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; temporaryPassword: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTrainer.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} removed.`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not remove trainer.");
        setDeleteTarget(null);
      },
    });
  };

  const handleResetPassword = () => {
    if (!resetTarget) return;
    resetPassword.mutate(resetTarget.id, {
      onSuccess: (result) => {
        setResetTarget(null);
        setResetResult({ email: result.email, temporaryPassword: result.temporaryPassword });
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not reset password.");
        setResetTarget(null);
      },
    });
  };

  return (
    <BranchLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Trainers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Runs sessions. Your own branch-manager account isn't listed here.
          </p>
        </div>
        <Button className="btn-cerise" onClick={() => setAddOpen(true)}>
          + Add Trainer
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading trainers…</div>
        ) : (trainers ?? []).length === 0 ? (
          <EmptyState icon={Dumbbell} title="No trainers added yet" actionLabel="+ Add Trainer" onAction={() => setAddOpen(true)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(trainers ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={t.photoUrl ?? undefined} />
                      <AvatarFallback>{initials(t.name)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.email}</TableCell>
                  <TableCell className="text-muted-foreground">{t.phone || "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={t.status === "active"}
                      onCheckedChange={(checked) => {
                        if (!checked) setConfirmSuspend(t);
                        else setStatus.mutate({ id: t.id, active: true });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditTarget(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Reset password" onClick={() => setResetTarget(t)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Delete" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t)}>
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

      <AddTrainerDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={(t) => setCreated({ name: t.name, email: t.email, temporaryPassword: t.temporaryPassword })} />
      <EditTrainerDialog trainer={editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <DialogTitle className="text-center">Trainer account created</DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Login email</p>
              <p className="text-sm font-medium">{created?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temporary password</p>
              <code className="text-base font-mono tracking-wide">{created?.temporaryPassword}</code>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            This password is shown once and has also been emailed to {created?.email}.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!created) return;
                navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.temporaryPassword}`);
                toast.success("Credentials copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button className="w-full btn-cerise" onClick={() => setCreated(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <DialogTitle className="text-center">Password reset</DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Login email</p>
              <p className="text-sm font-medium">{resetResult?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">New temporary password</p>
              <code className="text-base font-mono tracking-wide">{resetResult?.temporaryPassword}</code>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Shown once, and also emailed to them. Their old password stopped working immediately.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!resetResult) return;
                navigator.clipboard.writeText(`Email: ${resetResult.email}\nTemporary password: ${resetResult.temporaryPassword}`);
                toast.success("Credentials copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button className="w-full btn-cerise" onClick={() => setResetResult(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!confirmSuspend}
        onOpenChange={(o) => !o && setConfirmSuspend(null)}
        title={`Suspend ${confirmSuspend?.name ?? ""}?`}
        description="Suspending will prevent them from logging in. Any future sessions assigned to them will need reassignment."
        confirmLabel="Suspend"
        destructive
        loading={setStatus.isPending}
        onConfirm={() => {
          if (!confirmSuspend) return;
          setStatus.mutate(
            { id: confirmSuspend.id, active: false },
            {
              onSuccess: () => setConfirmSuspend(null),
              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not suspend trainer."),
            },
          );
        }}
      />

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.name ?? ""}?`}
        description="They'll lose access immediately. Past sessions they ran keep their history — this only removes them from your active roster. Blocked if they still have upcoming sessions on the books."
        confirmLabel="Remove"
        destructive
        loading={deleteTrainer.isPending}
        onConfirm={handleDelete}
      />

      <ConfirmActionDialog
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
        title={`Reset ${resetTarget?.name ?? ""}'s password?`}
        description="A new temporary password is generated, emailed to them, and shown here once. Their current password stops working immediately."
        confirmLabel="Reset Password"
        loading={resetPassword.isPending}
        onConfirm={handleResetPassword}
      />
    </BranchLayout>
  );
}

function AddTrainerDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (t: CreateTrainerResult) => void;
}) {
  const createTrainer = useCreateTrainer();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPhoneError("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePhone(phone);
    if (err) {
      setPhoneError(err);
      return;
    }
    createTrainer.mutate(
      { name, email, phone },
      {
        onSuccess: (t) => {
          onOpenChange(false);
          reset();
          onSuccess(t);
          toast.success(`${t.name} was added — their login details were emailed to ${email}.`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create trainer."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Trainer</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-name">Full Name</Label>
            <Input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-email">Email id</Label>
            <Input id="t-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Must be unique across every trainer, branch manager, member, and admin account platform-wide.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-phone">Phone Number</Label>
            <Input
              id="t-phone"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(validatePhone(e.target.value));
              }}
              onBlur={(e) => setPhoneError(validatePhone(e.target.value))}
            />
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            A unique ID and temporary password are generated automatically and emailed to this trainer along with
            their Branch Portal login link.
          </p>
          <DialogFooter>
            <Button type="submit" className="w-full btn-cerise" disabled={!!phoneError || createTrainer.isPending}>
              {createTrainer.isPending ? "Creating..." : "Add Trainer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTrainerDialog({ trainer, onOpenChange }: { trainer: Trainer | null; onOpenChange: (o: boolean) => void }) {
  const updateTrainer = useUpdateTrainer();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (trainer) {
      setName(trainer.name);
      setPhone(trainer.phone ?? "");
      setPhoneError("");
    }
  }, [trainer]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainer) return;
    const err = validatePhone(phone);
    if (err) {
      setPhoneError(err);
      return;
    }
    updateTrainer.mutate(
      { id: trainer.id, dto: { name, phone } },
      {
        onSuccess: () => {
          toast.success("Trainer details updated.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update trainer."),
      },
    );
  };

  return (
    <Dialog open={!!trainer} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Trainer</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="et-name">Full Name</Label>
            <Input id="et-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="et-phone">Phone Number</Label>
            <Input
              id="et-phone"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(validatePhone(e.target.value));
              }}
              onBlur={(e) => setPhoneError(validatePhone(e.target.value))}
            />
            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Email can't be changed here — it's their login identity. Contact admin if it needs to change.
          </p>
          <DialogFooter>
            <Button type="submit" className="w-full btn-cerise" disabled={!!phoneError || updateTrainer.isPending}>
              {updateTrainer.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
