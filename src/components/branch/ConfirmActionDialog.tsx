import { useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** When true, forces the acting admin to re-enter their own password
   * before the action proceeds — used for gym delete, admin creation,
   * and member anonymization per spec §5 "Session timeout + forced
   * re-auth for destructive actions". */
  requirePassword?: boolean;
  loading?: boolean;
  onConfirm: (password?: string) => void;
  children?: ReactNode;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  requirePassword,
  loading,
  onConfirm,
  children,
}: ConfirmActionDialogProps) {
  const [password, setPassword] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requirePassword && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-password">Confirm your password to continue</Label>
            <PasswordInput
              id="confirm-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={!destructive ? "btn-cerise" : undefined}
            disabled={loading || (requirePassword && password.length === 0)}
            onClick={() => onConfirm(requirePassword ? password : undefined)}
          >
            {loading ? "Working..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
