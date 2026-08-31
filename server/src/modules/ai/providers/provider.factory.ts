import { LLMProvider } from './provider.interface';
import { GroqProvider } from './groq.provider';
import { NvidiaProvider } from './nvidia.provider';

export class ProviderFactory {
  private static groqInstance: GroqProvider;
  private static nvidiaInstance: NvidiaProvider;

  static getProvider(providerName: 'GROQ' | 'NVIDIA' | string): LLMProvider {
    const normalized = providerName.toUpperCase();
    if (normalized === 'GROQ') {
      if (!this.groqInstance) {
        this.groqInstance = new GroqProvider();
      }
      return this.groqInstance;
    }

    if (normalized === 'NVIDIA') {
      if (!this.nvidiaInstance) {
        this.nvidiaInstance = new NvidiaProvider();
      }
      return this.nvidiaInstance;
    }

    throw new Error(`Unsupported AI Provider: ${providerName}`);
  }
}
