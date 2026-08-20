export type MemberStatus = "active" | "suspended" | "pending_transfer";
export type StaffRole = "trainer" | "branch_manager";
export type TrainerStatus = "active" | "suspended";
export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type AttendanceStatus = "enrolled" | "attended" | "no_show";
export type TransferStatus = "pending" | "accepted" | "declined" | "expired";

export type Sex = "male" | "female" | "other";

export interface Member {
  id: string;
  memberCode: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  photoUrl?: string | null;
  status: MemberStatus;
  currentGymId?: string | null;
  isAnonymized: boolean;
  createdAt: string;
  sessionMembers?: { id: string }[];
  // Biometric baseline — required for accurate zone/calorie calculation.
  ageYears?: number | null;
  sex?: Sex | null;
  heightCm?: number | null;
  weightKg?: number | null;
  restingHr?: number | null;
  // Present ONLY on the immediate response to register / reset-pin —
  // the plaintext PIN shown to staff exactly once so they can hand it
  // to the member on the spot. Never present on any other Member read.
  pin?: string;
}

// One completed session's stats for a single member — powers the
// "click leaderboard row -> member's stat for that workout" view.
export interface MemberSessionStat {
  sessionId: string;
  sessionName: string;
  startedAt: string;
  endedAt?: string | null;
  avgHr?: number | null;
  peakHr?: number | null;
  calories?: number | null;
  score?: number | null;
  zoneMinutes?: Record<string, number> | null;
  // Rich post-workout results (spec §7), when recorded.
  sweatPoints?: number | null;
  recoveryPoints?: number | null;
  recoveryGrade?: string | null;
  epocCalories?: number | null;
  epocHours?: number | null;
  avgPctMhr?: number | null;
  maxPctMhr?: number | null;
  finalRank?: number | null;
}

// Per-second HR tick, for the full graph view on a member's profile —
// mirrors the hub's GET /api/admin/sessions/:sid/athlete/:memberId/ticks.
export interface HrTick {
  ts: number;
  bpm: number;
  zone: number;
  pctMhr?: number | null;
}

// Aggregate profile: bio + every session they've participated in +
// their raw HR history, for the member's full detail screen.
export interface MemberProfile {
  member: Member;
  sessions: MemberSessionStat[];
  avgBpmOverall?: number | null;
  // Raw HR history across all of their sessions (most recent first),
  // mirrors the hub's hrData in GET /api/members/:id/profile — powers
  // the full BPM graph on the member's profile page.
  hrTicks?: HrTick[];
}


export interface PlatformMemberSearchResult {
  id: string;
  memberCode: string;
  name: string;
  status: MemberStatus;
  currentGym?: { id: string; name: string } | null;
}

export interface Trainer {
  id: string;
  gymId: string;
  name: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  role: StaffRole;
  status: TrainerStatus;
  createdAt: string;
}

export interface SessionMemberResult {
  id: string;
  memberId: string;
  member?: { id: string; name: string; memberCode: string };
  enrolledAt: string;
  attendance: AttendanceStatus;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  score?: number | null;
  // Rich post-workout results (spec §7), when recorded.
  sweatPoints?: number | null;
  recoveryPoints?: number | null;
  recoveryGrade?: string | null;
  epocCalories?: number | null;
  epocHours?: number | null;
  avgPctMhr?: number | null;
  maxPctMhr?: number | null;
  finalRank?: number | null;
}

export interface Session {
  id: string;
  gymId: string;
  trainerId: string;
  trainer?: { id: string; name: string };
  name: string;
  capacity: number;
  status: SessionStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  scheduledAt?: string | null;
  scheduledEndAt?: string | null;
  cancelledReason?: string | null;
  needsReassignment: boolean;
  createdAt: string;
  members?: SessionMemberResult[];
  _count?: { members: number };
}

export interface TransferRequest {
  id: string;
  memberId: string;
  member?: {
    id: string;
    name: string;
    memberCode: string;
    photoUrl?: string | null;
    sex?: Sex | null;
    ageYears?: number | null;
    heightCm?: number | null;
    weightKg?: number | null;
    restingHr?: number | null;
  };
  toGymId: string;
  status: TransferStatus;
  // 'admin' = an admin proposed this member to your branch — your branch
  // must accept/decline it here. 'branch' = your branch invited this
  // member — it's waiting on the member's own response, not yours.
  requestedByType: "admin" | "branch";
  createdAt: string;
  respondedAt?: string | null;
  expiresAt: string;
}

export interface GymProfile {
  id: string;
  name: string;
  address?: string | null;
  location?: string | null;
  gymPhone?: string | null;
  ownerContact?: string | null;
  contactEmail?: string | null;
  logoUrl?: string | null;
  status: "active" | "suspended" | "deleted";
  memberLimit: number;
  manager?: { id: string; name: string; email: string; phone?: string | null } | null;
  _count?: { currentMembers: number; trainers: number };
}
