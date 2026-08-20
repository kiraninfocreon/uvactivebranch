import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Activity, Ruler, Weight, Heart, Pencil, KeyRound, LogOut } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { StatusBadge } from "@/components/branch/StatusBadge";
import { ConfirmActionDialog } from "@/components/branch/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemberProfile, useUpdateMember, useResetMemberPin, useReleaseMember } from "@/hooks/branch/useMembers";
import { useAuth, ApiError } from "@/lib/auth-context";
import { Member, Sex } from "@/lib/types";
import { toast } from "sonner";

// Full member profile screen — bio + aggregate stats + full HR-tick
// graph across every session they've participated in + a session-by-
// session history that links back into that session's leaderboard.
// Backed by GET /branch/members/:id/profile.
export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMemberProfile(id);
  const { isBranchManager } = useAuth();
  const updateMember = useUpdateMember();
  const resetPin = useResetMemberPin();
  const releaseMember = useReleaseMember();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);

  const handleResetPin = () => {
    if (!id) return;
    resetPin.mutate(id, {
      onSuccess: (res) => {
        toast.success("PIN reset.");
        if (res?.plainPin) setNewPin(res.plainPin);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not reset PIN."),
    });
  };

  const handleRelease = () => {
    if (!id) return;
    releaseMember.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Member released from your gym.");
          navigate("/members");
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not release member."),
      },
    );
  };

  return (
    <BranchLayout>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => navigate("/members")}>
          <ArrowLeft className="h-4 w-4" /> Back to Members
        </Button>
        {isBranchManager && data && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleResetPin} disabled={resetPin.isPending}>
              <KeyRound className="h-3.5 w-3.5" /> Reset PIN
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => setConfirmRelease(true)}
            >
              <LogOut className="h-3.5 w-3.5" /> Release from gym
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading member profile…</div>
      ) : isError || !data ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          Couldn't load this member's full profile.
        </div>
      ) : (
        <MemberDetailContent
          member={data.member}
          sessions={data.sessions}
          avgBpmOverall={data.avgBpmOverall}
          hrTicks={data.hrTicks}
        />
      )}

      {data && (
        <EditMemberDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          member={data.member}
          loading={updateMember.isPending}
          onSubmit={(dto) => {
            if (!id) return;
            updateMember.mutate(
              { id, dto },
              {
                onSuccess: () => {
                  toast.success("Member details updated.");
                  setEditOpen(false);
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update member."),
              },
            );
          }}
        />
      )}

      <ConfirmActionDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title={`Release ${data?.member.name ?? "this member"} from your gym?`}
        description="Their history is kept — this cannot be undone from here."
        confirmLabel="Release"
        loading={releaseMember.isPending}
        onConfirm={handleRelease}
      />

      {/* New PIN reveal — shown once, same posture as the registration dialog */}
      <Dialog open={!!newPin} onOpenChange={(o) => !o && setNewPin(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">New PIN generated</DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Login PIN</p>
            <code className="text-lg font-mono tracking-widest">{newPin}</code>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Give this to the member — it also went out by SMS if they have a phone on file. It won't be shown here again.
          </p>
          <DialogFooter>
            <Button className="w-full btn-cerise" onClick={() => setNewPin(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchLayout>
  );
}

function EditMemberDialog({
  open,
  onOpenChange,
  member,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  loading?: boolean;
  onSubmit: (dto: {
    name: string; phone: string; email: string; sex: Sex; ageYears: number; heightCm: number; weightKg: number; restingHr: number;
  }) => void;
}) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [sex, setSex] = useState<Sex>(member.sex ?? "male");
  const [age, setAge] = useState(member.ageYears?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(member.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(member.weightKg?.toString() ?? "");
  const [restingHr, setRestingHr] = useState(member.restingHr?.toString() ?? "");

  useEffect(() => {
    if (!open) return;
    setName(member.name);
    setPhone(member.phone ?? "");
    setEmail(member.email ?? "");
    setSex(member.sex ?? "male");
    setAge(member.ageYears?.toString() ?? "");
    setHeightCm(member.heightCm?.toString() ?? "");
    setWeightKg(member.weightKg?.toString() ?? "");
    setRestingHr(member.restingHr?.toString() ?? "");
  }, [open, member]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name, phone, email, sex,
              ageYears: parseInt(age, 10), heightCm: parseFloat(heightCm), weightKg: parseFloat(weightKg), restingHr: parseInt(restingHr, 10),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="e-name">Full Name</Label>
            <Input id="e-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-phone">Phone Number</Label>
            <Input id="e-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-email">Email id</Label>
            <Input id="e-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-age">Age</Label>
              <Input id="e-age" type="number" min={10} max={100} required value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-height">Height (cm)</Label>
              <Input id="e-height" type="number" min={50} max={250} required value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-weight">Weight (kg)</Label>
              <Input id="e-weight" type="number" min={20} max={300} required value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="e-rhr">Resting HR (bpm)</Label>
              <Input id="e-rhr" type="number" min={30} max={120} required value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-cerise" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberDetailContent({
  member,
  sessions,
  avgBpmOverall,
  hrTicks,
}: {
  member: NonNullable<ReturnType<typeof useMemberProfile>["data"]>["member"];
  sessions: NonNullable<ReturnType<typeof useMemberProfile>["data"]>["sessions"];
  avgBpmOverall?: number | null;
  hrTicks?: { ts: number; bpm: number; zone: number }[];
}) {
  const navigate = useNavigate();
  const chartData = (hrTicks ?? [])
    .slice()
    .reverse()
    .map((t) => ({ time: format(new Date(t.ts), "MMM d, h:mm a"), bpm: t.bpm }));

  const peakOverall = sessions.reduce((max, s) => Math.max(max, s.peakHr ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{member.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{member.memberCode}</p>
        </div>
        <StatusBadge status={member.status} />
      </div>

      {/* Bio card */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <BioStat label="Age" value={member.ageYears ? `${member.ageYears}` : "—"} icon={Activity} />
        <BioStat label="Sex" value={member.sex ? member.sex[0].toUpperCase() + member.sex.slice(1) : "—"} icon={Activity} />
        <BioStat label="Height" value={member.heightCm ? `${member.heightCm} cm` : "—"} icon={Ruler} />
        <BioStat label="Weight" value={member.weightKg ? `${member.weightKg} kg` : "—"} icon={Weight} />
      </div>
      {(member.ageYears == null || member.heightCm == null || member.weightKg == null) && (
        <p className="text-xs text-muted-foreground -mt-4">
          Some biometric fields haven't been recorded for this member yet — edit their profile to add them.
        </p>
      )}

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Sessions Attended" value={`${sessions.length}`} />
        <StatTile label="Avg BPM (all-time)" value={avgBpmOverall ? `${Math.round(avgBpmOverall)}` : "—"} />
        <StatTile label="Peak HR (best)" value={peakOverall ? `${peakOverall}` : "—"} />
        <StatTile
          label="Total Calories"
          value={`${sessions.reduce((sum, s) => sum + (s.calories ?? 0), 0)}`}
        />
      </div>

      {/* Full HR graph across every session */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Heart Rate History (all sessions)</p>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No HR-tick data yet — this appears once the member has completed a sensor-tracked session.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" hide />
              <YAxis domain={["dataMin - 10", "dataMax + 10"]} />
              <RTooltip />
              <Line type="monotone" dataKey="bpm" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Session-by-session history */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-medium">Session History</p>
          <p className="text-xs text-muted-foreground">Click a session to open its full leaderboard.</p>
        </div>
        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No completed sessions yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Avg HR</TableHead>
                <TableHead>Peak HR</TableHead>
                <TableHead>Calories</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow
                  key={s.sessionId}
                  className="cursor-pointer"
                  onClick={() => navigate(`/sessions?open=${s.sessionId}`)}
                >
                  <TableCell className="font-medium">{s.sessionName}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(s.startedAt), "MMM d, yyyy")}</TableCell>
                  <TableCell>{s.avgHr ?? "—"}</TableCell>
                  <TableCell>{s.peakHr ?? "—"}</TableCell>
                  <TableCell>{s.calories ?? "—"}</TableCell>
                  <TableCell>{s.score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function BioStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
