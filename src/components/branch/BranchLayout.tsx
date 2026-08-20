import { ReactNode } from "react";
import { BranchSidebar } from "./BranchSidebar";
import { SuspendedScreen } from "./SuspendedScreen";
import { useGymSuspended } from "@/lib/use-gym-suspended";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

// No manager/gym name repeated on every single tab anymore — that's
// redundant once the Dashboard greets the manager by name, and each
// page already carries its own heading. Log out now lives at the
// bottom of the sidebar (see BranchSidebar) for desktop.
//
// The sidebar itself is desktop-only (hidden below `md`), so this
// slim mobile-only bar exists purely so a phone user still has a way
// to log out — it deliberately carries nothing else.
export function BranchLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const suspended = useGymSuspended();

  return (
    <div className="min-h-screen flex bg-background">
      <BranchSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 shrink-0 border-b border-border flex items-center justify-end px-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => logout()}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </header>

        {suspended ? <SuspendedScreen /> : <main className="flex-1 p-6 overflow-auto">{children}</main>}
      </div>
    </div>
  );
}
