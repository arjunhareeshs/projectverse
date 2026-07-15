import crypto from 'crypto';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import axios from 'axios';

const AI_SERVICE_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';
const INTERNAL_TOKEN_SECRET = process.env['INTERNAL_TOKEN_SECRET'] || '';

function computeInternalSignature(secret: string, userId: string, role: string, timestamp: string): string {
  const message = `${userId}.${role}.${timestamp}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function buildInternalHeaders(user: any): Record<string, string> {
  const ts = String(Math.floor(Date.now() / 1000));
  const role = (user.role || 'STUDENT').toUpperCase();
  const token = computeInternalSignature(INTERNAL_TOKEN_SECRET, user.id, role, ts);

  const headers: Record<string, string> = {
    'X-Internal-User-Id': user.id,
    'X-Internal-Role': role,
    'X-Internal-Timestamp': ts,
    'X-Internal-Token': token,
    'Content-Type': 'application/json',
  };

  if (user.teamId) headers['X-Internal-Team-Id'] = user.teamId;
  if (user.organizationId) headers['X-Internal-Org-Id'] = user.organizationId;

  return headers;
}

export const aiController = {
  // Simple non-streaming query — used by Project Designer and other simple contexts
  async handleQuery(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const { prompt, conversationId } = req.body;

      if (!prompt) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Prompt is required' });
      }

      // Forward to Python AI microservice
      const response = await axios.post(`${AI_SERVICE_URL}/api/v1/inference`, {
        prompt,
        user_id: user.id,
        organization_id: user.organizationId,
        conversation_id: conversationId,
      });

      return res.json({ response: response.data?.response || response.data?.content || 'AI response received.' });
    } catch (error: any) {
      console.error('Error proxying AI request:', error?.response?.data || error.message);

      return res.json({
        response: `I'm your AI assistant! (Note: The Python inference service is currently offline or returning an error: ${error.message})`
      });
    }
  },

  // Real SSE streaming agent chat — routes through the LangGraph agent with tools
  async handleChat(req: Request, res: Response) {
    const user = req.user;
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    }

    const { prompt, sessionId } = req.body;
    if (!prompt) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'prompt is required' });
    }

    const session = sessionId || `${user.id}-${Date.now()}`;

    // Resolve teamId: look it up if not on user object
    let teamId = user.teamId || null;
    if (!teamId) {
      try {
        const { prisma } = await import('../../shared/database');
        const membership = await prisma.teamMember.findFirst({
          where: { userId: user.id },
          select: { teamId: true },
        });
        teamId = membership?.teamId || null;
      } catch {
        // Non-fatal — proceed without teamId
      }
    }

    const userWithTeam = { ...user, teamId };
    const internalHeaders = buildInternalHeaders(userWithTeam);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendFrame = (event: string, data: string) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    try {
      // Stream from Python agent
      const aiRes = await axios.post(
        `${AI_SERVICE_URL}/chat`,
        { prompt, session_id: session },
        {
          headers: internalHeaders,
          responseType: 'stream',
          timeout: 120_000,
        }
      );

      const stream = aiRes.data as NodeJS.ReadableStream;
      let buffer = '';

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        // Parse SSE frames from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            sendFrame(currentEvent, data);
            currentEvent = 'message';
          }
        }
      });

      stream.on('end', () => {
        // Python agent already sends an explicit 'done' SSE frame — do NOT send another one here.
        // Sending two 'done' frames causes the frontend to append the message twice.
        res.end();
      });


      stream.on('error', (err: Error) => {
        console.error('[AI Chat Stream] Stream error:', err.message);
        sendFrame('error', JSON.stringify({ detail: err.message }));
        res.end();
      });

      // Handle client disconnect
      req.on('close', () => {
        stream.destroy();
      });

    } catch (error: any) {
      const detail = error?.response?.data?.detail || error.message || 'Unknown error';
      console.error('[AI Chat] Error connecting to agent:', detail);

      // Graceful fallback: still respond as SSE
      sendFrame('text.delta', JSON.stringify({ text: `I'm having trouble connecting to the AI service right now. Please try again in a moment.` }));
      sendFrame('done', '{}');
      res.end();
    }
  },
};
