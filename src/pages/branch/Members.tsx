import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { StatusBadge } from "@/components/branch/StatusBadge";
import { EmptyState } from "@/components/branch/EmptyState";
import { ConfirmActionDialog } from "@/components/branch/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, QrCode, MoreVertical, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMembers, useRegisterMember, useReleaseMember, useSearchMemberByCode } from "@/hooks/branch/useMembers";
import { useGymProfile } from "@/hooks/branch/useGymProfile";
import { useSendTransferRequest } from "@/hooks/branch/useTransferRequests";
import { ApiError } from "@/lib/auth-context";
import { Member, PlatformMemberSearchResult, Sex } from "@/lib/types";

const CONSENT_VERSION = "v1";

export default function Members() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: members, isLoading } = useMembers();
  const { data: gym } = useGymProfile();
  const registerMember = useRegisterMember();
  const releaseMember = useReleaseMember();
  const searchByCode = useSearchMemberByCode();
  const sendTransfer = useSendTransferRequest();

  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [platformSearchOpen, setPlatformSearchOpen] = useState(false);
  const [registeredMember, setRegisteredMember] = useState<Member | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Member | null>(null);
  const [releaseReason, setReleaseReason] = useState("");

  useEffect(() => {
    if (params.get("register") === "1") setRegisterOpen(true);
  }, [params]);

  const filtered = (members ?? []).filter(
    (m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.memberCode.toLowerCase().includes(search.toLowerCase()),
  );

  const atCap = !!gym && gym._count && gym._count.currentMembers >= gym.memberLimit;

  const closeRegisterDialog = (open: boolean) => {
    setRegisterOpen(open);
    if (!open && params.get("register")) {
      params.delete("register");
      setParams(params, { replace: true });
    }
  };

  return (
    <BranchLayout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold">Members</h1>
          {gym && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {gym._count?.currentMembers ?? members?.length ?? 0}/{gym.memberLimit}
            </p>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button className="btn-cerise gap-2" disabled={atCap} onClick={() => setRegisterOpen(true)}>
                + Register Member
              </Button>
            </span>
          </TooltipTrigger>
          {atCap && <TooltipContent>Member limit reached</TooltipContent>}
        </Tooltip>
      </div>

      <div className="flex items-center gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setPlatformSearchOpen(true)}>
              <QrCode className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Scan QR / search platform-wide by ID</TooltipContent>
        </Tooltip>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading roster…</div>
        ) : (members ?? []).length === 0 ? (
          <EmptyState icon={Users} title="No members registered yet" actionLabel="+ Register Member" onAction={() => setRegisterOpen(true)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/members/${m.id}`)}
                >
                  <TableCell className="font-mono text-xs">{m.memberCode}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.phone || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell>{m.sessionMembers?.length ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(m.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/members/${m.id}`)}>
                          View full profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-amber-500 focus:text-amber-500"
                          onClick={() => setReleaseTarget(m)}
                        >
                          Release from gym
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Register Member */}
      <RegisterMemberDialog
        open={registerOpen}
        onOpenChange={closeRegisterDialog}
        onSuccess={(m) => setRegisteredMember(m)}
      />

      {/* Registration success */}
      <Dialog open={!!registeredMember} onOpenChange={(o) => !o && setRegisteredMember(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <DialogTitle className="text-center">Member Registered!</DialogTitle>
          </DialogHeader>
          {registeredMember && (
            <div className="bg-muted rounded-lg p-4 text-center space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Member ID</p>
                <code className="text-lg font-mono">{registeredMember.memberCode}</code>
              </div>
              {registeredMember.pin && (
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Login PIN</p>
                  <code className="text-lg font-mono tracking-widest">{registeredMember.pin}</code>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">
            Give this ID + PIN to the member to log in to the UV Active app. It's also{registeredMember?.phone ? " sent by SMS" : ""}
            {registeredMember?.phone && registeredMember?.email ? " and" : ""}
            {registeredMember?.email ? ` emailed to ${registeredMember.email}` : ""} as a backup — it won't be shown here again.
          </p>
          <DialogFooter>
            <Button className="w-full btn-cerise" onClick={() => setRegisteredMember(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Platform-wide search */}
      <PlatformSearchDialog
        open={platformSearchOpen}
        onOpenChange={setPlatformSearchOpen}
        onSearch={(code) => searchByCode.mutateAsync(code)}
        result={searchByCode.data}
        loading={searchByCode.isPending}
        onSendRequest={(memberId) =>
          sendTransfer.mutate(memberId, {
            onSuccess: () => {
              toast.success("Join request sent.");
              setPlatformSearchOpen(false);
              searchByCode.reset();
            },
            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not send join request."),
          })
        }
      />

      {/* Release confirm */}
      <ConfirmActionDialog
        open={!!releaseTarget}
        onOpenChange={(o) => !o && setReleaseTarget(null)}
        title={`Release ${releaseTarget?.name ?? ""} from this branch?`}
        description="Their history is kept — this cannot be undone from here."
        confirmLabel="Release"
        loading={releaseMember.isPending}
        onConfirm={() => {
          if (!releaseTarget) return;
          releaseMember.mutate(
            { id: releaseTarget.id, reason: releaseReason || undefined },
            {
              onSuccess: () => {
                toast.success("Member released.");
                setReleaseTarget(null);
                setReleaseReason("");
              },
              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not release member."),
            },
          );
        }}
      >
        <div className="space-y-2 pt-2">
          <Label htmlFor="release-reason">Reason (optional)</Label>
          <Textarea id="release-reason" value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} />
        </div>
      </ConfirmActionDialog>
    </BranchLayout>
  );
}

// ── Register Member dialog ────────────────────────────────────────────
// Same bounds as the hub (server.js POST /api/members) so a member
// registered here behaves identically once they're on a sensor.
function validateBiometrics({ age, heightCm, weightKg, restingHr, phone }: {
  age: string; heightCm: string; weightKg: string; restingHr: string; phone: string;
}): string | null {
  if (!phone.trim()) return "Phone number is required.";
  const digits = phone.replace(/[\s\-()+]/g, "");
  if (!/^\d{10,15}$/.test(digits)) return "Enter a valid phone number (10–15 digits).";

  if (!age) return "Age is required.";
  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 10 || ageNum > 100) return "Age must be between 10 and 100.";

  if (!heightCm) return "Height is required.";
  const heightNum = parseFloat(heightCm);
  if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) return "Height must be between 50 and 250 cm.";

  if (!weightKg) return "Weight is required.";
  const weightNum = parseFloat(weightKg);
  if (isNaN(weightNum) || weightNum < 20 || weightNum > 300) return "Weight must be between 20 and 300 kg.";

  if (!restingHr) return "Resting HR is required.";
  const rhrNum = parseInt(restingHr, 10);
  if (isNaN(rhrNum) || rhrNum < 30 || rhrNum > 120) return "Resting HR must be between 30 and 120 bpm.";

  return null;
}

function RegisterMemberDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (member: Member) => void;
}) {
  const registerMember = useRegisterMember();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setEmail("");
      setAge("");
      setSex("male");
      setHeightCm("");
      setWeightKg("");
      setRestingHr("");
      setConsent(false);
      setError("");
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateBiometrics({ age, heightCm, weightKg, restingHr, phone });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    registerMember.mutate(
      {
        name,
        phone,
        email,
        consentVersion: CONSENT_VERSION,
        consentAccepted: consent,
        ageYears: parseInt(age, 10),
        sex,
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        restingHr: parseInt(restingHr, 10),
      },
      {
        onSuccess: (member) => {
          onOpenChange(false);
          onSuccess(member);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not register member."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">Full Name</Label>
            <Input id="m-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-phone">Phone Number</Label>
            <Input id="m-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-email">Email id</Label>
            <Input id="m-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Their member ID + PIN and their web-portal login (this email + a generated password) are both sent here.
              Must be unique across every member, trainer, branch manager, and admin account.
            </p>
          </div>

          {/* Biometric baseline — same fields/bounds as the hub's member form,
              needed for accurate zone/calorie/HR-based session stats. */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-age">Age</Label>
              <Input id="m-age" type="number" min={10} max={100} required value={age} onChange={(e) => setAge(e.target.value)} />
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
              <Label htmlFor="m-height">Height (cm)</Label>
              <Input id="m-height" type="number" min={50} max={250} required value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-weight">Weight (kg)</Label>
              <Input id="m-weight" type="number" min={20} max={300} required value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="m-rhr">Resting HR (bpm)</Label>
              <Input id="m-rhr" type="number" min={30} max={120} required value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-start gap-2">
            <Checkbox id="m-consent" checked={consent} onCheckedChange={(c) => setConsent(!!c)} />
            <Label htmlFor="m-consent" className="font-normal text-sm leading-snug">
              The member has been informed about and consents to UV Active collecting their data, including
              session/health metrics.
            </Label>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full btn-cerise" disabled={!consent || registerMember.isPending}>
              {registerMember.isPending ? "Registering..." : "Register Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Platform-wide search dialog ───────────────────────────────────────
function PlatformSearchDialog({
  open,
  onOpenChange,
  onSearch,
  result,
  loading,
  onSendRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (code: string) => Promise<PlatformMemberSearchResult>;
  result?: PlatformMemberSearchResult;
  loading: boolean;
  onSendRequest: (memberId: string) => void;
}) {
  const [code, setCode] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSearch(code.trim().toUpperCase());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No member found with that ID.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search Platform-Wide</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Look up a member by their exact ID (or scan their QR code) to send them a join request.
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <Input placeholder="UVA-XXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" disabled={loading || !code.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </form>

        {result && (
          <div className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{result.name}</p>
              <p className="text-xs text-muted-foreground">
                {result.currentGym ? `Currently at ${result.currentGym.name}` : "Not currently assigned to a gym"}
              </p>
            </div>
            <Button className="btn-cerise shrink-0" onClick={() => onSendRequest(result.id)}>
              Send Join Request
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
