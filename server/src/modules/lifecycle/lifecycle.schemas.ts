import { z } from 'zod';

export const intakeSchema = z.discriminatedUnion('step', [
  z
    .object({
      step: z.literal('members'),
      memberUserIds: z.array(z.string()).optional(),
      members: z.array(z.string()).optional(),
    })
    .transform((val) => ({
      step: 'members' as const,
      memberUserIds: val.memberUserIds ?? val.members ?? [],
    })),
  z.object({
    step: z.literal('duration'),
    months: z.number().int().min(1).max(18),
    startDate: z.string().optional(),
  }),
  z.object({
    step: z.literal('technologies'),
    technologies: z.array(z.string()),
  }),
]);

export const durationCheckSchema = z.object({
  months: z.number().int().min(1).max(18),
  category: z.enum(['MINI', 'FINAL_YEAR', 'RESEARCH']).optional(),
  title: z.string().optional(),
});

export const suggestMembersSchema = z.object({
  desiredCount: z.number().int().min(1).max(10).optional(),
  requiredSkills: z.array(z.string()).optional(),
});

export const dailyLogSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD
  workDone: z.string().min(3, 'Work done description must be at least 3 characters long'),
  hoursSpent: z.number().positive().optional(),
  blockers: z.string().optional(),
  evidenceUrls: z.array(z.string()).optional(),
});

export const mentorAskSchema = z.object({
  question: z.string().min(2, 'Question must be at least 2 characters long'),
});

export const workPackageStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']),
});

export const workPackageAssignSchema = z.object({
  assignedTo: z.array(z.string()),
});

export const milestoneStatusSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'MISSED']),
});

export const deadlineChangeSchema = z.object({
  dueDate: z.string().min(10),
  reason: z.string().optional(),
});

export const flagResolveSchema = z.object({
  note: z.string().optional(),
});

export const manualNoteSchema = z.object({
  note: z.string().min(2, 'Note content must be at least 2 characters long'),
});

export const memberAddSchema = z.object({
  userId: z.string().min(1),
  name: z.string().optional(),
});
