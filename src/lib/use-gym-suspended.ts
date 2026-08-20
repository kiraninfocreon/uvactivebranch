import { useEffect, useState } from "react";
import { onGymSuspended } from "./api";

/**
 * True once ANY request in this session has come back GYM_SUSPENDED.
 * Deliberately sticky for the rest of the session (persists across
 * navigation) — a suspended branch doesn't become un-suspended by
 * clicking to a different page; only logging out (or the admin
 * reactivating and the staff logging back in) clears it.
 */
export function useGymSuspended(): boolean {
  const [suspended, setSuspended] = useState(false);
  useEffect(() => onGymSuspended(() => setSuspended(true)), []);
  return suspended;
}
