import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, CalendarClock, ArrowLeftRight, Dumbbell, Radio, Settings as SettingsIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import uvLogo from "@/assets/uv-logo.jpg";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/sessions", label: "Sessions", icon: CalendarClock },
  { to: "/transfer-requests", label: "Transfer Requests", icon: ArrowLeftRight },
  { to: "/trainers", label: "Trainers", icon: Dumbbell },
  { to: "/sensors", label: "Sensors", icon: Radio },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BranchSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar">
      <div className="h-16 flex items-center px-6 gap-2">
        <img src={uvLogo} alt="UV Active" className="h-8 w-8 rounded-md object-cover shrink-0" />
        <span className="font-heading text-lg font-bold text-sidebar-foreground">
          UV Active <span className="text-primary">Branch</span>
        </span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4 pt-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>
    </aside>
  );
}
