import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../middleware/authGuard';
import { providerConfigService } from './providerConfig.service';
import { AIProvider } from '@prisma/client';

function parseProvider(raw: string | string[] | undefined): AIProvider | null {
  if (!raw) return null;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const upper = str?.toUpperCase();
  if (upper === 'GROQ') return AIProvider.GROQ;
  if (upper === 'NVIDIA') return AIProvider.NVIDIA;
  return null;
}

export class AIProviderController {
  /**
   * GET /api/ai/providers
   * Returns current user's provider statuses with masked keys.
   */
  async getProviders(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const result = await providerConfigService.getUserProviders(userId);
      return res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      console.error('[AIProviderController] getProviders error:', err.message);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to retrieve AI providers' });
    }
  }

  /**
   * PUT /api/ai/providers/:provider
   * Validates, encrypts and saves an API key for the authenticated user.
   */
  async saveProvider(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const provider = parseProvider(req.params.provider);
      if (!provider) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid AI provider specified. Expected GROQ or NVIDIA.' });
      }

      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Please provide a valid API key string' });
      }

      const result = await providerConfigService.saveProviderKey(userId, provider, apiKey);

      return res.status(StatusCodes.OK).json({
        provider,
        configured: true,
        maskedKey: result.maskedKey,
        lastValidatedAt: result.lastValidatedAt,
      });
    } catch (err: any) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: err.message || 'Failed to validate and save AI API key',
      });
    }
  }

  /**
   * DELETE /api/ai/providers/:provider
   * Permanently removes the encrypted provider key.
   */
  async deleteProvider(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const provider = parseProvider(req.params.provider);
      if (!provider) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid AI provider specified. Expected GROQ or NVIDIA.' });
      }

      await providerConfigService.deleteProviderKey(userId, provider);
      return res.status(StatusCodes.OK).json({ success: true, message: `${provider} key successfully removed` });
    } catch (err: any) {
      console.error('[AIProviderController] deleteProvider error:', err.message);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to delete provider key' });
    }
  }

  /**
   * POST /api/ai/providers/:provider/validate
   * Tests an API key live without saving it.
   */
  async validateProvider(req: AuthenticatedRequest, res: Response) {
    try {
      const provider = parseProvider(req.params.provider);
      if (!provider) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid AI provider specified. Expected GROQ or NVIDIA.' });
      }

      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'API key is required for validation' });
      }

      const result = await providerConfigService.validateProviderKey(provider, apiKey);
      return res.status(StatusCodes.OK).json(result);
    } catch (err: any) {
      return res.status(StatusCodes.OK).json({ valid: false, error: err.message || 'Validation failed' });
    }
  }
}

export const aiProviderController = new AIProviderController();
