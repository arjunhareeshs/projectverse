import crypto from 'crypto';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../shared/database';
import { signAccessToken } from '../../config/jwt';
import { RoleType } from '@prisma/client';
import { env } from '../../config/env';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
});

const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'Email or register number is required'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential token is required'),
});

const githubUsernameSchema = z.object({
  githubUsername: z.string().trim().max(100).nullable().optional(),
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
        OR: [{ email: parsed.identifier }, { regNo: parsed.identifier }],
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

  static async googleLogin(data: unknown) {
    const parsed = googleAuthSchema.parse(data);

    // Verify token with Google's tokeninfo API
    let tokenInfo: any;
    try {
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.credential)}`
      );
      tokenInfo = response.data;
    } catch (err: any) {
      console.error('Failed to verify Google ID token:', err.response?.data || err.message);
      throw new Error('Invalid or expired Google token');
    }

    if (!tokenInfo || !tokenInfo.email) {
      throw new Error('Google token does not contain a valid email address');
    }

    // Verify Google ID token issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (tokenInfo.iss && !validIssuers.includes(tokenInfo.iss)) {
      throw new Error('Invalid Google token issuer');
    }

    // Verify Google client ID audience when configured
    const configuredClientId = env.GOOGLE_CLIENT_ID;
    if (
      configuredClientId &&
      configuredClientId !== 'your-google-client-id.apps.googleusercontent.com' &&
      configuredClientId.includes('.apps.googleusercontent.com')
    ) {
      if (tokenInfo.aud !== configuredClientId) {
        console.error(`Google token audience mismatch. Expected: ${configuredClientId}, Got: ${tokenInfo.aud}`);
        throw new Error('Google token client ID mismatch');
      }
    }

    // Verify email is verified by Google
    if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
      throw new Error('Google email is not verified');
    }

    // Verify token expiration
    if (tokenInfo.exp && Number(tokenInfo.exp) * 1000 < Date.now()) {
      throw new Error('Google token has expired');
    }

    const email = String(tokenInfo.email).toLowerCase().trim();
    const fullName = tokenInfo.name || tokenInfo.given_name || email.split('@')[0];

    // Find existing user or create a new student account
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const randomPassword = crypto.randomUUID();
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          role: RoleType.STUDENT,
        },
      });
    }

    const token = signAccessToken({
      sub: user.id,
      role: user.role,
      orgId: user.organizationId || undefined,
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
        githubUsername: true,
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
            totalPoints: 'desc',
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            groupCode: true,
            groupLevel: true,
            ranking: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  }

  static async updateGithubUsername(userId: string, data: unknown) {
    const parsed = githubUsernameSchema.parse(data);
    const cleaned = parsed.githubUsername
      ? parsed.githubUsername.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/$/, '')
      : null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { githubUsername: cleaned || null },
      select: { id: true, githubUsername: true },
    });

    return user;
  }
}

export const authService = new AuthService();
