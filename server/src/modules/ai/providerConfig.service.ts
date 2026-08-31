import { prisma } from '../../shared/database';
import { AIProvider } from '@prisma/client';
import {
  encryptApiKey,
  decryptApiKey,
  fingerprintApiKey,
  maskApiKey,
} from './apiKeyEncryption.service';
import { ProviderFactory } from './providers/provider.factory';

export interface UserProviderStatusDTO {
  provider: 'GROQ' | 'NVIDIA';
  configured: boolean;
  enabled: boolean;
  maskedKey?: string;
  lastValidatedAt?: Date | null;
  lastUsedAt?: Date | null;
  lastErrorCode?: string | null;
  lastErrorAt?: Date | null;
}

export class ProviderConfigService {
  /**
   * Returns sanitized provider configurations for the given user.
   * Plaintext and encrypted keys are NEVER returned.
   */
  async getUserProviders(userId: string): Promise<{ providers: UserProviderStatusDTO[] }> {
    const records = await prisma.userAIProvider.findMany({
      where: { userId },
    });

    const recordMap = new Map(records.map((r) => [r.provider, r]));

    const allProviders: AIProvider[] = [AIProvider.GROQ, AIProvider.NVIDIA];

    const providers: UserProviderStatusDTO[] = allProviders.map((provider) => {
      const record = recordMap.get(provider);
      if (!record) {
        return {
          provider: provider as 'GROQ' | 'NVIDIA',
          configured: false,
          enabled: false,
        };
      }

      let maskedKey = '••••';
      try {
        const decrypted = decryptApiKey(record.encryptedApiKey);
        maskedKey = maskApiKey(decrypted);
      } catch {
        maskedKey = '••••(Corrupt)';
      }

      return {
        provider: record.provider as 'GROQ' | 'NVIDIA',
        configured: true,
        enabled: record.isEnabled,
        maskedKey,
        lastValidatedAt: record.lastValidatedAt,
        lastUsedAt: record.lastUsedAt,
        lastErrorCode: record.lastErrorCode,
        lastErrorAt: record.lastErrorAt,
      };
    });

    return { providers };
  }

  /**
   * Validates and saves an encrypted API key for the authenticated user.
   */
  async saveProviderKey(
    userId: string,
    provider: AIProvider,
    rawApiKey: string,
  ): Promise<{ success: boolean; maskedKey: string; lastValidatedAt: Date }> {
    const trimmedKey = rawApiKey?.trim();
    if (!trimmedKey || trimmedKey.length < 8) {
      throw new Error('Please provide a valid API key');
    }

    // 1. Live Validation against Provider
    const adapter = ProviderFactory.getProvider(provider);
    const validation = await adapter.validateKey(trimmedKey);
    if (!validation.valid) {
      throw new Error(validation.error || `${provider} API key could not be verified.`);
    }

    // 2. Encryption and Fingerprinting
    const encryptedApiKey = encryptApiKey(trimmedKey);
    const keyFingerprint = fingerprintApiKey(trimmedKey);
    const now = new Date();

    // 3. Store in Database
    await prisma.userAIProvider.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        encryptedApiKey,
        keyFingerprint,
        isEnabled: true,
        lastValidatedAt: now,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      create: {
        userId,
        provider,
        encryptedApiKey,
        keyFingerprint,
        isEnabled: true,
        lastValidatedAt: now,
      },
    });

    return {
      success: true,
      maskedKey: maskApiKey(trimmedKey),
      lastValidatedAt: now,
    };
  }

  /**
   * Validates a key live with the provider adapter without saving.
   */
  async validateProviderKey(
    provider: AIProvider,
    rawApiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const trimmedKey = rawApiKey?.trim();
    if (!trimmedKey) {
      return { valid: false, error: 'API key is required' };
    }
    const adapter = ProviderFactory.getProvider(provider);
    return adapter.validateKey(trimmedKey);
  }

  /**
   * Permanently deletes a provider API key for the user.
   */
  async deleteProviderKey(userId: string, provider: AIProvider): Promise<boolean> {
    const res = await prisma.userAIProvider.deleteMany({
      where: {
        userId,
        provider,
      },
    });
    return res.count > 0;
  }

  /**
   * Retrieves and decrypts the user's active API key for a specific provider.
   * INTERNAL ONLY — never expose over API.
   */
  async getDecryptedKeyForUser(
    userId: string,
    provider: AIProvider,
  ): Promise<string | null> {
    const record = await prisma.userAIProvider.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!record || !record.isEnabled || !record.encryptedApiKey) {
      return null;
    }

    try {
      return decryptApiKey(record.encryptedApiKey);
    } catch (err: any) {
      console.error(`[ProviderConfigService] Decryption failed for user ${userId}, provider ${provider}:`, err.message);
      return null;
    }
  }

  /**
   * Records usage observability metadata without storing prompt/response bodies.
   */
  async recordUsage(data: {
    userId: string;
    provider: AIProvider;
    model?: string;
    requestId?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    status: 'SUCCESS' | 'FAILURE' | 'FALLBACK';
    errorCode?: string;
  }) {
    try {
      await prisma.aIUsageLog.create({
        data: {
          userId: data.userId,
          provider: data.provider,
          model: data.model,
          requestId: data.requestId,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: data.totalTokens,
          latencyMs: data.latencyMs,
          status: data.status,
          errorCode: data.errorCode,
        },
      });
    } catch (err: any) {
      // Usage logging failure should never break AI responses
      console.error('[ProviderConfigService] Failed to record AI usage log:', err.message);
    }
  }

  /**
   * Updates provider status (lastUsedAt, lastErrorCode)
   */
  async updateProviderStatus(
    userId: string,
    provider: AIProvider,
    status: { isSuccess: boolean; errorCode?: string },
  ) {
    try {
      const now = new Date();
      await prisma.userAIProvider.updateMany({
        where: { userId, provider },
        data: {
          lastUsedAt: now,
          ...(status.isSuccess
            ? { lastErrorCode: null }
            : {
                lastErrorCode: status.errorCode || 'UNKNOWN_ERROR',
                lastErrorAt: now,
              }),
        },
      });
    } catch {
      // Non-critical background update
    }
  }
}

export const providerConfigService = new ProviderConfigService();
