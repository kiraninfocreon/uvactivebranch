import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import uvLogo from "@/assets/uv-logo.jpg";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { staff } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <img src={uvLogo} alt="UV Active" className="h-14 w-14 rounded-xl object-cover mx-auto mb-5" />
        <h1 className="mb-2 text-5xl font-bold tracking-tight">404</h1>
        <p className="mb-1 text-lg font-medium text-foreground">Page not found</p>
        <p className="mb-6 text-sm text-muted-foreground">
          Nothing lives at <span className="font-mono">{location.pathname}</span>.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate(staff ? "/" : "/login")} className="w-full">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {staff ? "Back to dashboard" : "Go to login"}
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
