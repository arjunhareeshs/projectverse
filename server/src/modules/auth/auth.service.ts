import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../shared/database';
import { signAccessToken } from '../../config/jwt';
import { RoleType } from '@prisma/client';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or register number is required'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Auth Service ─────────────────────────────────────────────────────────────

export class AuthService {
  static async register(data: unknown) {
    const parsed = registerSchema.parse(data);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });

    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(parsed.password, salt);

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        fullName: parsed.fullName,
        passwordHash,
        role: RoleType.STUDENT, // Default role; Admin can upgrade later
      },
    });

    const token = signAccessToken({
      sub: user.id,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
        teamId: user.teamId,
      },
    };
  }

  static async login(data: unknown) {
    const parsed = loginSchema.parse(data);

    // Accept email OR regNo as the identifier
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: parsed.identifier },
          { regNo: parsed.identifier },
        ],
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(parsed.password, user.passwordHash);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = signAccessToken({
      sub: user.id,
      role: user.role,
    });

    return {
      token,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
        regNo: user.regNo,
        teamId: user.teamId,
      },
    };
  }

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true,
        teamId: true,
        regNo: true,
        year: true,
        department: true,
        deptCode: true,
        cluster: true,
        gender: true,
        resident: true,
        learningMode: true,
        ssgEnrolled: true,
        ssgDomain: true,
        groupRegistered: true,
        skillsRegistered: true,
        rewardPoints: true,
        activityPoints: true,
        teamRole: true,
        createdAt: true,
        userSkills: {
          orderBy: {
            totalPoints: 'desc'
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            groupCode: true,
            groupLevel: true,
            ranking: true,
          }
        }
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  }
}

export const authService = new AuthService();
