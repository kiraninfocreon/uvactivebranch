import { useState } from "react";
import { toast } from "sonner";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { StatusBadge } from "@/components/branch/StatusBadge";
import { EmptyState } from "@/components/branch/EmptyState";
import { ConfirmActionDialog } from "@/components/branch/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useTransferRequests,
  useAcceptTransferRequest,
  useDeclineTransferRequest,
} from "@/hooks/branch/useTransferRequests";
import { TransferRequest } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function TransferRequests() {
  const { data: requests, isLoading } = useTransferRequests();
  const accept = useAcceptTransferRequest();
  const decline = useDeclineTransferRequest();

  const [detailTarget, setDetailTarget] = useState<TransferRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<TransferRequest | null>(null);

  const handleAccept = (r: TransferRequest) => {
    accept.mutate(r.id, {
      onSuccess: () => toast.success(`${r.member?.name ?? "Member"} added to your branch.`),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not accept transfer request."),
    });
  };

  const handleDecline = () => {
    if (!declineTarget) return;
    decline.mutate(declineTarget.id, {
      onSuccess: () => {
        toast.success("Transfer request declined.");
        setDeclineTarget(null);
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not decline transfer request.");
        setDeclineTarget(null);
      },
    });
  };

  return (
    <BranchLayout>
      <h1 className="font-heading text-2xl font-bold mb-1">Transfer Requests</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Admin-proposed transfers wait on your accept or decline below. Requests your branch sent to a member wait on
        their response instead — tap a card to view the member's details.
      </p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (requests ?? []).length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transfer requests yet." />
        ) : (
          <div className="divide-y divide-border">
            {(requests ?? []).map((r) => {
              const needsResponse = r.requestedByType === "admin" && r.status === "pending";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDetailTarget(r)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.member?.name ?? "Member"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.member?.memberCode}</p>
                    {r.status === "pending" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.requestedByType === "admin"
                          ? `Proposed by admin ${formatDistanceToNow(new Date(r.createdAt))} ago`
                          : `Sent ${formatDistanceToNow(new Date(r.createdAt))} ago, awaiting member response`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {needsResponse ? (
                      <>
                        <Button
                          size="sm"
                          className="btn-cerise"
                          disabled={accept.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(r);
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeclineTarget(r);
                          }}
                        >
                          <X className="h-4 w-4 mr-1" /> Decline
                        </Button>
                      </>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailTarget?.member?.name ?? "Member"}</DialogTitle>
          </DialogHeader>
          {detailTarget?.member && (
            <div className="grid grid-cols-2 gap-3 text-sm pt-2">
              <Detail label="Member code" value={detailTarget.member.memberCode} mono />
              <Detail label="Sex" value={detailTarget.member.sex ?? "—"} capitalize />
              <Detail label="Age" value={detailTarget.member.ageYears != null ? `${detailTarget.member.ageYears} yrs` : "—"} />
              <Detail label="Height" value={detailTarget.member.heightCm != null ? `${detailTarget.member.heightCm} cm` : "—"} />
              <Detail label="Weight" value={detailTarget.member.weightKg != null ? `${detailTarget.member.weightKg} kg` : "—"} />
              <Detail label="Resting HR" value={detailTarget.member.restingHr != null ? `${detailTarget.member.restingHr} bpm` : "—"} />
              <Detail label="Request status" value={detailTarget.status} capitalize />
              <Detail
                label="Requested by"
                value={detailTarget.requestedByType === "admin" ? "Admin" : "Your branch"}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!declineTarget}
        onOpenChange={(o) => !o && setDeclineTarget(null)}
        title="Decline transfer request?"
        description={`${declineTarget?.member?.name ?? "This member"} will not be added to your branch. This can't be undone from here — the admin would need to send a new request.`}
        confirmLabel="Decline"
        destructive
        loading={decline.isPending}
        onConfirm={handleDecline}
      />
    </BranchLayout>
  );
}

function Detail({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}
