import { ShieldAlert } from "lucide-react";

/**
 * Replaces the ENTIRE content area (never just a toast) the moment the
 * API reports GYM_SUSPENDED — a branch can be suspended by Admin at
 * any time, on any screen, and staff should never be looking at a
 * half-broken dashboard when that happens.
 */
export function SuspendedScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="font-heading text-xl font-bold">Your branch has been suspended</h1>
        <p className="text-sm text-muted-foreground">
          Contact UV Active support to resolve this before you can continue using the Branch Portal.
        </p>
        <a
          href="mailto:support@uvactive.com"
          className="inline-flex items-center justify-center btn-cerise text-sm"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
