import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth, ApiError } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { renderGoogleButton, googleClientId } from "@/lib/google-identity";
import { ShieldCheck, Copy, ShieldAlert } from "lucide-react";
import uvLogo from "@/assets/uv-logo.jpg";

type Step = "credentials" | "totp" | "setup" | "suspended" | "forgot-email" | "forgot-otp";

export default function BranchLogin() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<{ otpauthUrl: string; secret: string; backupCodes: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  // Google is an alternate FIRST factor only — TOTP verification below
  // still applies identically either way, so we just remember which
  // path produced the pending second-factor challenge.
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const { login, loginWithGoogle, completeTotpSetup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== "credentials" || !googleBtnRef.current) return;
    renderGoogleButton(googleBtnRef.current, handleGoogleToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleAuthResult = async (result: { setupRequired?: boolean; setupToken?: string; totpRequired?: boolean }) => {
    if (result.setupRequired && result.setupToken) {
      setSetupToken(result.setupToken);
      const { data } = await api.post<{ otpauthUrl: string; secret: string; backupCodes: string[] }>(
        "/auth/staff/2fa/setup",
        { setupToken: result.setupToken },
        { auth: false },
      );
      setSetupSecret(data);
      setStep("setup");
    } else if (result.totpRequired) {
      setStep("totp");
    } else {
      navigate("/");
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    try {
      setPendingGoogleIdToken(idToken);
      const result = await loginWithGoogle(idToken);
      await handleAuthResult(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "GYM_SUSPENDED") {
        setStep("suspended");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Google sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setPendingGoogleIdToken(null);
      const result = await login(email, password);
      await handleAuthResult(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "GYM_SUSPENDED") {
        setStep("suspended");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Incorrect email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const code = useBackupCode ? undefined : totp;
      const backup = useBackupCode ? backupCode : undefined;
      if (pendingGoogleIdToken) {
        await loginWithGoogle(pendingGoogleIdToken, code, backup);
      } else {
        await login(email, password, code, backup);
      }
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "GYM_SUSPENDED") {
        setStep("suspended");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Invalid code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetupConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupToken) return;
    setLoading(true);
    try {
      await completeTotpSetup(setupToken, totp);
      toast.success("Two-factor authentication enabled.");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupSecret) return;
    navigator.clipboard.writeText(setupSecret.secret);
    toast.success("Secret key copied");
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/staff/forgot-password", { email }, { auth: false });
      toast.success("If that email has a staff account, a reset code is on its way.");
      setStep("forgot-otp");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send the reset code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/staff/reset-password", { email, otp: resetOtp, newPassword }, { auth: false });
      toast.success("Password updated — sign in with your new password.");
      setResetOtp("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setPassword("");
      setStep("credentials");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That code is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={uvLogo} alt="UV Active" className="h-14 w-14 rounded-xl object-cover mx-auto mb-3" />
          <h1 className="font-heading text-3xl font-bold">
            UV<span className="text-primary">Active</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Branch Portal</p>
        </div>

        {step === "suspended" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <p className="font-semibold">Your branch has been suspended</p>
            <p className="text-sm text-muted-foreground">Please contact UV Active support to resolve this.</p>
            <a href="mailto:support@uvactive.com" className="inline-flex w-full items-center justify-center btn-cerise">
              Contact Support
            </a>
          </div>
        )}

        {step === "credentials" && (
          <>
            <form onSubmit={handleCredentials} className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="font-heading font-semibold text-center">Branch Login</h2>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setStep("forgot-email")}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full btn-cerise" disabled={loading}>
                {loading ? "Checking..." : "Log In"}
              </Button>

              {googleClientId && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div ref={googleBtnRef} className="flex justify-center" />
                </>
              )}
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Having trouble? Contact UV Active support.
            </p>
          </>
        )}

        {step === "forgot-email" && (
          <form onSubmit={handleForgotRequest} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your staff account's email and we'll send a 6-digit reset code.
            </p>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full btn-cerise" disabled={loading}>
              {loading ? "Sending..." : "Send reset code"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Back to sign in
            </button>
          </form>
        )}

        {step === "forgot-otp" && (
          <form onSubmit={handleForgotConfirm} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="text-foreground font-medium">{email}</span> and choose
              a new password. The code expires in 15 minutes.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-otp">Reset code</Label>
              <Input
                id="reset-otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em]"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                placeholder="••••••••"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password-confirm">Confirm new password</Label>
              <PasswordInput
                id="new-password-confirm"
                placeholder="••••••••"
                minLength={8}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                required
              />
              {newPasswordConfirm.length > 0 && newPasswordConfirm !== newPassword && (
                <p className="text-xs text-destructive">Passwords don't match.</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full btn-cerise"
              disabled={loading || newPassword.length < 8 || newPassword !== newPasswordConfirm}
            >
              {loading ? "Updating..." : "Reset password"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("forgot-email")}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Send a new code
            </button>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleTotpVerify} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Enter the 6-digit code from your authenticator app
            </div>
            {!useBackupCode ? (
              <div className="space-y-2">
                <Label htmlFor="totp">Authentication code</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="backup">Backup code</Label>
                <Input
                  id="backup"
                  placeholder="xxxx-xxxx"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full btn-cerise" disabled={loading}>
              {loading ? "Verifying..." : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setUseBackupCode(!useBackupCode)}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
            </button>
          </form>
        )}

        {step === "setup" && setupSecret && (
          <form onSubmit={handleSetupConfirm} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Set up two-factor authentication</p>
              <p>
                Two-factor authentication is mandatory for every Branch Portal account. Add this account to Google
                Authenticator (or any TOTP app) using the key below, then enter the 6-digit code it generates.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-3 flex items-center justify-between gap-2">
              <code className="text-xs break-all">{setupSecret.secret}</code>
              <button type="button" onClick={copySecret} className="shrink-0 text-muted-foreground hover:text-foreground">
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-totp">Verification code</Label>
              <Input
                id="setup-totp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em]"
                autoFocus
                required
              />
            </div>

            <Button type="submit" className="w-full btn-cerise" disabled={loading}>
              {loading ? "Confirming..." : "Confirm & Sign In"}
            </Button>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground mb-1.5">Backup codes — save these somewhere safe</p>
              <p className="text-xs text-muted-foreground mb-2">
                Each code can be used once if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {setupSecret.backupCodes.map((code) => (
                  <code key={code} className="text-[11px] bg-muted rounded px-2 py-1 text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
