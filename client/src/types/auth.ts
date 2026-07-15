export type UserRole = 'ADMIN' | 'STUDENT';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  teamId?: string | null;
  regNo?: string | null;
  year?: string | null;
  department?: string | null;
  deptCode?: string | null;
  cluster?: string | null;
  gender?: string | null;
  resident?: string | null;
  learningMode?: string | null;
  ssgEnrolled?: boolean;
  ssgDomain?: string | null;
  groupRegistered?: boolean;
  skillsRegistered?: boolean;
  rewardPoints?: number;
  activityPoints?: number;
  teamRole?: string | null;
  userSkills?: any[];
  team?: {
    id: string;
    name: string;
    groupCode?: string | null;
    groupLevel?: string | null;
    ranking?: any;
  } | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}
