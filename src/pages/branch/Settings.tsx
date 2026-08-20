import { useEffect, useState } from "react";
import { BranchLayout } from "@/components/branch/BranchLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGymProfile, useUpdateGymProfile, useUpdateManagerName } from "@/hooks/branch/useGymProfile";
import { useChangePassword } from "@/hooks/branch/useChangePassword";
import { ApiError } from "@/lib/auth-context";

export default function Settings() {
  const { data: gym, isLoading } = useGymProfile();
  const updateProfile = useUpdateGymProfile();
  const updateManagerName = useUpdateManagerName();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [managerName, setManagerName] = useState("");

  useEffect(() => {
    if (!gym) return;
    setName(gym.name ?? "");
    setAddress(gym.address ?? "");
    setLocation(gym.location ?? "");
    setGymPhone(gym.gymPhone ?? "");
    setManagerName(gym.manager?.name ?? "");
  }, [gym]);

  if (isLoading || !gym) {
    return (
      <BranchLayout>
        <div className="text-sm text-muted-foreground">Loading settings…</div>
      </BranchLayout>
    );
  }

  const managerNameChanged = managerName.trim() !== (gym.manager?.name ?? "").trim() && managerName.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const requests: Promise<unknown>[] = [
      new Promise((resolve, reject) =>
        updateProfile.mutate({ name, address, location, gymPhone }, { onSuccess: resolve, onError: reject }),
      ),
    ];
    if (managerNameChanged) {
      requests.push(
        new Promise((resolve, reject) => updateManagerName.mutate(managerName, { onSuccess: resolve, onError: reject })),
      );
    }
    Promise.all(requests)
      .then(() => toast.success("Settings saved."))
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Could not save settings."));
  };

  const saving = updateProfile.isPending || updateManagerName.isPending;

  return (
    <BranchLayout>
      <div className="max-w-xl mx-auto">
        <h1 className="font-heading text-2xl font-bold mb-6">Settings</h1>

        <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gym-name">Name of Gym</Label>
            <Input id="gym-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Area / city" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gym-phone">Phone number of gym</Label>
            <Input id="gym-phone" value={gymPhone} onChange={(e) => setGymPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-name">Manager Name</Label>
            <Input id="manager-name" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Manager Email</p>
              <p className="text-sm">{gym.manager?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Manager Phone</p>
              <p className="text-sm">{gym.manager?.phone ?? "—"}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Manager email and phone can only be changed by UV Active Admin — contact support for those.
          </p>

          <Button type="submit" className="btn-cerise" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>

        <div className="mt-4 bg-muted/40 border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Member Limit</p>
            <p className="text-sm font-medium">{gym.memberLimit}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Member limit is set by UV Active Admin — contact support to change it.
        </p>

        <ChangePasswordCard />
      </div>
    </BranchLayout>
  );
}

// ── Change Password ────────────────────────────────────────────────
function ChangePasswordCard() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const valid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success("Password updated.");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update password. Check your current password."),
      },
    );
  };

  return (
    <form onSubmit={submit} className="mt-6 bg-card border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Change Password</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Update the password used to log in to this Branch Portal.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <PasswordInput
          id="current-password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password-settings">New password</Label>
        <PasswordInput
          id="new-password-settings"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {tooShort && <p className="text-xs text-destructive">Password must be at least 8 characters.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password-settings">Confirm new password</Label>
        <PasswordInput
          id="confirm-password-settings"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don't match.</p>}
      </div>
      <Button type="submit" className="btn-cerise" disabled={!valid || changePassword.isPending}>
        {changePassword.isPending ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
