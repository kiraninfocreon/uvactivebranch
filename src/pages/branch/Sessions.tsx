import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { StatusBadge } from "@/components/branch/StatusBadge";
import { EmptyState } from "@/components/branch/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock, CalendarPlus, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { useSessions, useSession, useCreateSession, useEnrollMember, useCancelSession, useSessionAthleteTicks } from "@/hooks/branch/useSessions";
import { useTrainers } from "@/hooks/branch/useTrainers";
import { useMembers } from "@/hooks/branch/useMembers";
import { useSensors } from "@/hooks/branch/useSensors";
import { ApiError } from "@/lib/auth-context";
import { Session, SessionMemberResult } from "@/lib/types";

export default function Sessions() {
  const [params, setParams] = useSearchParams();
  const { data: sessions, isLoading } = useSessions();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("schedule") === "1") setScheduleOpen(true);
    const open = params.get("open");
    if (open) setOpenSessionId(open);
  }, [params]);

  const onlyNeedsReassignment = params.get("needsReassignment") === "1";
  const list = useMemo(() => {
    const all = sessions ?? [];
    return onlyNeedsReassignment ? all.filter((s) => s.needsReassignment) : all;
  }, [sessions, onlyNeedsReassignment]);

  const grouped = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    for (const s of list) {
      const key = s.scheduledAt ? format(new Date(s.scheduledAt), "EEEE, MMM d") : "Unscheduled";
      (groups[key] ||= []).push(s);
    }
    return groups;
  }, [list]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of list) {
      if (!s.scheduledAt) continue;
      const key = format(new Date(s.scheduledAt), "yyyy-MM-dd");
      (map[key] ||= []).push(s);
    }
    return map;
  }, [list]);

  const selectedDaySessions = selectedDate ? sessionsByDate[selectedDate] ?? [] : [];

  const clearParams = () => setParams({}, { replace: true });

  return (
    <BranchLayout>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-heading text-2xl font-bold">Sessions</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${view === "list" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${view === "calendar" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
          </div>
          <Button className="btn-cerise gap-2" onClick={() => setScheduleOpen(true)}>
            <CalendarPlus className="h-4 w-4" /> Schedule Session
          </Button>
        </div>
      </div>

      {onlyNeedsReassignment && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2">
          <p className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Showing sessions that need a new trainer
          </p>
          <Button size="sm" variant="ghost" onClick={clearParams}>
            Show all
          </Button>
        </div>
      )}

      {view === "calendar" ? (
        <CalendarGrid
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          sessionsByDate={sessionsByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading sessions…</div>
          ) : list.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No sessions scheduled yet" actionLabel="+ Schedule Session" onAction={() => setScheduleOpen(true)} />
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(grouped).map(([day, daySessions]) => (
                <div key={day} className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">{day}</p>
                  <div className="space-y-2">
                    {daySessions.map((s) => (
                      <SessionRow key={s.id} session={s} onClick={() => setOpenSessionId(s.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "calendar" && selectedDate && (
        <div className="bg-card border border-border rounded-xl mt-4">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium">{format(new Date(`${selectedDate}T00:00`), "EEEE, MMM d")}</p>
            <Button size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>
              Clear
            </Button>
          </div>
          <div className="p-4 space-y-2">
            {selectedDaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions scheduled on this day.</p>
            ) : (
              selectedDaySessions.map((s) => <SessionRow key={s.id} session={s} onClick={() => setOpenSessionId(s.id)} />)
            )}
          </div>
        </div>
      )}

      <ScheduleSessionDialog
        open={scheduleOpen}
        onOpenChange={(o) => {
          setScheduleOpen(o);
          if (!o && params.get("schedule")) clearParams();
        }}
      />

      <SessionDetailSheet
        sessionId={openSessionId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenSessionId(null);
            if (params.get("open")) clearParams();
          }
        }}
      />
    </BranchLayout>
  );
}

// ── Shared session row (used by both the list view and the calendar's
// selected-day list) ──────────────────────────────────────────────────
function SessionRow({ session: s, onClick }: { session: Session; onClick: () => void }) {
  const enrolled = s._count?.members ?? 0;
  const pct = Math.min(100, Math.round((enrolled / Math.max(s.capacity, 1)) * 100));
  const cancelled = s.status === "cancelled";
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors text-left"
    >
      <div className={cancelled ? "line-through text-muted-foreground" : ""}>
        <p className="text-sm font-medium">
          {s.scheduledAt ? format(new Date(s.scheduledAt), "h:mm a") : "—"}
          {s.scheduledEndAt ? ` – ${format(new Date(s.scheduledEndAt), "h:mm a")}` : ""} · {s.name}
        </p>
        <p className="text-xs text-muted-foreground">{s.trainer?.name}</p>
      </div>
      <div className="flex items-center gap-3">
        {s.needsReassignment && (
          <span className="text-xs rounded-full bg-destructive/15 text-destructive px-2 py-0.5">Needs trainer</span>
        )}
        {!cancelled && (
          <div className="w-28">
            <p className="text-xs text-muted-foreground text-right mb-1">
              {enrolled}/{s.capacity}
            </p>
            <Progress value={pct} />
          </div>
        )}
        <StatusBadge status={s.status} />
      </div>
    </button>
  );
}

// ── Calendar view — a real month grid, days with sessions marked, click
// a day to see what's scheduled on it ─────────────────────────────────
function CalendarGrid({
  month,
  onMonthChange,
  sessionsByDate,
  selectedDate,
  onSelectDate,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  sessionsByDate: Record<string, Session[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-heading font-semibold">{format(month, "MMMM yyyy")}</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMonthChange(new Date())}>
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate[key] ?? [];
          const inMonth = isSameMonth(day, month);
          const selected = selectedDate === key;
          return (
            <button
              key={key}
              onClick={() => onSelectDate(selected ? "" : key)}
              className={[
                "aspect-square rounded-lg border p-1.5 flex flex-col items-start justify-start text-left transition-colors",
                inMonth ? "border-border" : "border-transparent opacity-40",
                selected ? "bg-primary/15 border-primary" : "hover:bg-muted/50",
              ].join(" ")}
            >
              <span className={`text-xs ${isToday(day) ? "font-bold text-primary" : ""}`}>{format(day, "d")}</span>
              {daySessions.length > 0 && (
                <span className="mt-auto text-[10px] rounded-full bg-primary/20 text-primary px-1.5 py-0.5">
                  {daySessions.length} {daySessions.length === 1 ? "session" : "sessions"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Schedule Session ────────────────────────────────────────────────
// Local "today" (yyyy-MM-dd) so the date picker won't offer past dates —
// same rule the hub enforces server-side ("Cannot schedule sessions in
// the past").
function todayForDateInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function ScheduleSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: trainers } = useTrainers();
  const { data: sensors } = useSensors();
  const createSession = useCreateSession();
  const [name, setName] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dateError, setDateError] = useState("");
  const minDate = useMemo(() => todayForDateInput(), [open]);

  // Capacity is no longer a field anyone sets by hand — it's always the
  // number of physical sensor straps ("sensor slots") registered at this
  // gym, computed server-side the moment the session is created (spec:
  // "already added sensors slots if 6 they can add only 6 members ...
  // above that not permit"). This is read-only, informational context
  // for the person scheduling, not an input.
  const sensorSlots = sensors?.length ?? 0;
  const hasSensors = sensorSlots > 0;

  useEffect(() => {
    if (!open) {
      setName("");
      setTrainerId("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setDateError("");
    }
  }, [open]);

  const activeTrainers = (trainers ?? []).filter((t) => t.status === "active");

  const scheduledAt = date && startTime ? new Date(`${date}T${startTime}`) : null;
  const scheduledEndAt = date && endTime ? new Date(`${date}T${endTime}`) : null;

  const validate = (): string => {
    if (!scheduledAt) return "";
    if (scheduledAt < new Date()) return "Cannot schedule sessions in the past — pick a future date and time.";
    if (scheduledEndAt && scheduledEndAt <= scheduledAt) return "End time must be after the start time.";
    return "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setDateError(err);
      return;
    }
    createSession.mutate(
      {
        name,
        trainerId,
        scheduledAt: scheduledAt!.toISOString(),
        scheduledEndAt: scheduledEndAt ? scheduledEndAt.toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Session scheduled.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not schedule session."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-name">Session name</Label>
            <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trainer</Label>
            <Select value={trainerId} onValueChange={setTrainerId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a trainer" />
              </SelectTrigger>
              <SelectContent>
                {activeTrainers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-date">Date</Label>
            <Input
              id="s-date"
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (dateError) setDateError("");
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-start">Start time</Label>
              <Input
                id="s-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (dateError) setDateError("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-end">End time</Label>
              <Input
                id="s-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (dateError) setDateError("");
                }}
              />
            </div>
          </div>
          {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          <div className="space-y-2">
            <Label>Capacity</Label>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm">Sensor slots</span>
              <span className="text-sm font-medium">{hasSensors ? sensorSlots : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasSensors
                ? `Automatically set to ${sensorSlots} — the number of sensors registered at your gym. No manual input needed.`
                : "No sensors registered yet — add them under Sensors and capacity will be set automatically."}
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full btn-cerise" disabled={!trainerId || createSession.isPending}>
              {createSession.isPending ? "Scheduling..." : "Schedule Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Session detail ─────────────────────────────────────────────────
function SessionDetailSheet({ sessionId, onOpenChange }: { sessionId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: session } = useSession(sessionId ?? undefined);
  const { data: members } = useMembers();
  const enrollMember = useEnrollMember();
  const cancelSession = useCancelSession();
  const [addMemberId, setAddMemberId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Selected leaderboard row + its position (rank) in the score-sorted
  // leaderboard — drives the per-member session-stat drill-down.
  const [statTarget, setStatTarget] = useState<{ member: SessionMemberResult; rank: number } | null>(null);

  if (!session) return null;

  const enrolledCount = session.members?.length ?? 0;
  const full = enrolledCount >= session.capacity;
  const completed = session.status === "completed";
  const enrolledIds = new Set((session.members ?? []).map((m) => m.memberId));
  const eligibleMembers = (members ?? []).filter((m) => !enrolledIds.has(m.id));

  const addMember = () => {
    if (!addMemberId || !sessionId) return;
    enrollMember.mutate(
      { sessionId, memberId: addMemberId },
      {
        onSuccess: () => setAddMemberId(""),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add member."),
      },
    );
  };

  return (
    <Sheet open={!!sessionId} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{session.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-muted-foreground">{session.trainer?.name}</p>
              <p className="text-muted-foreground">
                {session.scheduledAt ? format(new Date(session.scheduledAt), "EEE, MMM d · h:mm a") : "—"}
              </p>
            </div>
            <StatusBadge status={session.status} />
          </div>

          {completed ? (
            <div>
              <p className="text-sm font-medium mb-2">Results</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Rank</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Avg HR</TableHead>
                    <TableHead>Max HR</TableHead>
                    <TableHead>Calories</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(session.members ?? [])
                    .slice()
                    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
                    .map((m, i) => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => setStatTarget({ member: m, rank: m.finalRank ?? i + 1 })}>
                        <TableCell className="font-mono text-muted-foreground">{m.finalRank ?? i + 1}</TableCell>
                        <TableCell>{m.member?.name}</TableCell>
                        <TableCell>{m.avgHr ?? "—"}</TableCell>
                        <TableCell>{m.maxHr ?? "—"}</TableCell>
                        <TableCell>{m.calories ?? "—"}</TableCell>
                        <TableCell>{m.score ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">Click a member to see their full stats for this workout.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Roster</p>
                <p className="text-xs text-muted-foreground">
                  {enrolledCount}/{session.capacity} enrolled
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(session.members ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.member?.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.attendance} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center gap-2 mt-3">
                <Select value={addMemberId} onValueChange={setAddMemberId} disabled={full}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={full ? "Session Full" : "Select a member to add"} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled={full || !addMemberId} onClick={addMember}>
                        + Add Member
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {full && <TooltipContent>Session Full</TooltipContent>}
                </Tooltip>
              </div>
            </div>
          )}

          {!completed && session.status !== "cancelled" && (
            <button
              type="button"
              className="text-sm text-destructive underline underline-offset-2"
              onClick={() => setCancelOpen(true)}
            >
              Cancel Session
            </button>
          )}
        </div>
      </SheetContent>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason for cancellation</Label>
            <Textarea id="cancel-reason" required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            All {enrolledCount} enrolled member{enrolledCount === 1 ? "" : "s"} will be notified immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Session
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancelSession.isPending}
              onClick={() => {
                if (!sessionId) return;
                cancelSession.mutate(
                  { id: sessionId, reason: cancelReason },
                  {
                    onSuccess: () => {
                      toast.success("Session cancelled — members notified.");
                      setCancelOpen(false);
                    },
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not cancel session."),
                  },
                );
              }}
            >
              {cancelSession.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberSessionStatDialog
        sessionId={sessionId}
        target={statTarget}
        onOpenChange={(o) => !o && setStatTarget(null)}
      />
    </Sheet>
  );
}

// ── Leaderboard drill-down: one member's full post-workout stat ──────
// Click a row on a completed session's leaderboard -> Rank, UV Points,
// Sweat Points, Recovery Points, Calories, EPOC, Avg/Peak BPM, Max %HR
// and a zone-colored BPM graph for just this session, with a link
// through to their full cross-session profile.
const ZONE_COLORS: Record<number, string> = {
  0: "#6B7280", 1: "#669FFF", 2: "#4263CF", 3: "#1E2C7C", 4: "#FF5E73", 5: "#FF0000",
};
const ZONE_NAMES: Record<number, string> = {
  0: "Standby", 1: "Recovery", 2: "Aerobic", 3: "Fitness", 4: "Burn", 5: "Peak",
};

function MemberSessionStatDialog({
  sessionId,
  target,
  onOpenChange,
}: {
  sessionId: string | null;
  target: { member: SessionMemberResult; rank: number } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: ticksData, isLoading } = useSessionAthleteTicks(sessionId ?? undefined, target?.member.memberId);

  const t = target?.member;
  const chartData = (ticksData?.ticks ?? []).map((p) => ({
    time: format(new Date(p.ts), "h:mm:ss a"),
    bpm: p.bpm,
    zone: p.zone ?? 0,
  }));

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t?.member?.name}
            {t?.member?.memberCode ? <span className="ml-1 text-xs text-muted-foreground font-mono">{t.member.memberCode}</span> : null}
          </DialogTitle>
        </DialogHeader>

        {/* Full post-workout result — Rank, UV/Sweat/Recovery points,
            Calories, EPOC, Avg/Peak BPM, Max %HR. */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatBox label="Rank" value={target?.rank != null ? `#${target.rank}` : "—"} />
          <StatBox label="UV Points" value={t?.score != null ? String(Math.round(t.score * 10) / 10) : "—"} />
          <StatBox label="Sweat Points" value={t?.sweatPoints != null ? String(Math.round(t.sweatPoints * 10) / 10) : "—"} />
          <StatBox label="Recovery Points" value={t?.recoveryPoints != null ? String(Math.round(t.recoveryPoints * 10) / 10) : "—"} />
          <StatBox label="Calories" value={t?.calories != null ? `${Math.round(t.calories)} kcal` : "—"} />
          <StatBox label="EPOC (kcal)" value={t?.epocCalories != null ? String(Math.round(t.epocCalories)) : "—"} />
          <StatBox label="Avg BPM" value={t?.avgHr ?? "—"} />
          <StatBox label="Peak BPM" value={t?.maxHr ?? "—"} />
          <StatBox label="Max %HR" value={t?.maxPctMhr != null ? `${Math.round(t.maxPctMhr)}%` : "—"} />
        </div>

        <div className="mt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading BPM graph…</p>
          ) : chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No second-by-second BPM data available for this session yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" hide />
                <YAxis domain={["dataMin - 10", "dataMax + 10"]} />
                <RTooltip />
                {/* One Line per HR zone, so each segment of the graph is
                    colored by the zone that tick fell in. */}
                {Object.keys(ZONE_COLORS).map((z) => (
                  <Line
                    key={z}
                    type="monotone"
                    dataKey="bpm"
                    stroke={ZONE_COLORS[+z]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    data={chartData.map((p) => (p.zone === +z ? p : { ...p, bpm: null }))}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {chartData.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
              {Object.entries(ZONE_NAMES).map(([z, name]) => (
                <span key={z} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ZONE_COLORS[+z] }} />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => t && navigate(`/members/${t.memberId}`)}
          >
            View Full Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/50 rounded-lg py-2 px-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
