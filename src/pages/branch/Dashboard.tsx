import { useNavigate } from "react-router-dom";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { EmptyState } from "@/components/branch/EmptyState";
import { useDashboard } from "@/hooks/branch/useDashboard";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserPlus, CalendarPlus, Users, Dumbbell, Radio, CalendarClock, ArrowLeftRight, AlertTriangle, CalendarX } from "lucide-react";
import { format } from "date-fns";

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard();
  const { staff } = useAuth();
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <BranchLayout>
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </BranchLayout>
    );
  }

  const memberPct = Math.min(100, Math.round((data.memberCount / Math.max(data.memberLimit, 1)) * 100));
  const nearCap = memberPct >= 85;

  return (
    <BranchLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {timeGreeting()}, {staff?.name} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Have a great day at {staff?.gymName}.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="btn-cerise gap-2" onClick={() => navigate("/members?register=1")}>
            <UserPlus className="h-4 w-4" /> Register Member
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/sessions?schedule=1")}>
            <CalendarPlus className="h-4 w-4" /> Schedule Session
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" /> Members
            </div>
            <p className="text-2xl font-bold">
              {data.memberCount}
              <span className="text-base text-muted-foreground font-normal">/{data.memberLimit}</span>
            </p>
            <Progress value={memberPct} className={nearCap ? "[&>div]:bg-amber-500" : undefined} />
            {nearCap && <p className="text-xs text-amber-400">Getting close to your member limit.</p>}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Dumbbell className="h-4 w-4" /> Trainers
            </div>
            <p className="text-2xl font-bold">{data.trainerCount}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Radio className="h-4 w-4" /> Sensor Slots
            </div>
            <p className="text-2xl font-bold">{data.sensorCount}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CalendarClock className="h-4 w-4" /> Sessions Today
            </div>
            <p className="text-2xl font-bold">{data.sessionsToday.length}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-sm">
              <span className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Pending Requests
              </span>
              {data.pendingTransferCount > 0 && (
                <span className="text-xs rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5">
                  {data.pendingTransferCount}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{data.pendingTransferCount}</p>
          </div>
        </div>

        {data.needsReassignment.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm font-medium">
                {data.needsReassignment.length} session{data.needsReassignment.length > 1 ? "s" : ""} need
                {data.needsReassignment.length === 1 ? "s" : ""} a new trainer
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => navigate("/sessions?needsReassignment=1")}>
              Review
            </Button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-heading font-semibold mb-4">Today's Sessions</h2>
          {data.sessionsToday.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="No sessions scheduled for today"
              actionLabel="+ Schedule Session"
              onAction={() => navigate("/sessions?schedule=1")}
            />
          ) : (
            <div className="space-y-3">
              {data.sessionsToday.map((s) => {
                const enrolled = s._count?.members ?? 0;
                const pct = Math.min(100, Math.round((enrolled / Math.max(s.capacity, 1)) * 100));
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sessions?open=${s.id}`)}
                    className="w-full text-left flex items-center justify-between gap-4 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {s.scheduledAt ? format(new Date(s.scheduledAt), "h:mm a") : "—"} · {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.trainer?.name}</p>
                    </div>
                    <div className="w-32 shrink-0">
                      <p className="text-xs text-muted-foreground text-right mb-1">
                        {enrolled}/{s.capacity} enrolled
                      </p>
                      <Progress value={pct} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BranchLayout>
  );
}
