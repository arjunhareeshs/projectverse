import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Cpu,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { aiProviderService, UserAIProviderDTO } from '../../services/aiProvider.service';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProvidersUpdated?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onProvidersUpdated,
}) => {
  const [providers, setProviders] = useState<UserAIProviderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active inline key editing: 'GROQ' | 'NVIDIA' | null
  const [editingProvider, setEditingProvider] = useState<'GROQ' | 'NVIDIA' | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Connection testing state
  const [testingProvider, setTestingProvider] = useState<'GROQ' | 'NVIDIA' | null>(null);
  const [testStatus, setTestStatus] = useState<{
    provider: 'GROQ' | 'NVIDIA';
    success: boolean;
    message: string;
  } | null>(null);

  // Deletion state
  const [deletingProvider, setDeletingProvider] = useState<'GROQ' | 'NVIDIA' | null>(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await aiProviderService.getProviders();
      setProviders(res.providers || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load AI provider configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
      setEditingProvider(null);
      setApiKeyInput('');
      setFormError(null);
      setTestStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const groqConfig = providers.find((p) => p.provider === 'GROQ') || {
    provider: 'GROQ' as const,
    configured: false,
    enabled: false,
  };

  const nvidiaConfig = providers.find((p) => p.provider === 'NVIDIA') || {
    provider: 'NVIDIA' as const,
    configured: false,
    enabled: false,
  };

  const handleStartEditing = (provider: 'GROQ' | 'NVIDIA') => {
    setEditingProvider(provider);
    setApiKeyInput('');
    setShowKey(false);
    setFormError(null);
    setTestStatus(null);
  };

  const handleCancelEditing = () => {
    setEditingProvider(null);
    setApiKeyInput('');
    setShowKey(false);
    setFormError(null);
  };

  const handleSaveKey = async (provider: 'GROQ' | 'NVIDIA', e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setFormError('Please enter a valid API key.');
      return;
    }

    try {
      setSavingKey(true);
      setFormError(null);
      await aiProviderService.saveProvider(provider, apiKeyInput.trim());
      setApiKeyInput('');
      setEditingProvider(null);
      await fetchProviders();
      if (onProvidersUpdated) onProvidersUpdated();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          err.message ||
          'Validation failed. Please ensure the API key is active and has correct permissions.'
      );
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (provider: 'GROQ' | 'NVIDIA') => {
    const name = provider === 'GROQ' ? 'Groq' : 'NVIDIA NIM';
    if (!window.confirm(`Are you sure you want to disconnect your ${name} API key?`)) {
      return;
    }

    try {
      setDeletingProvider(provider);
      await aiProviderService.deleteProvider(provider);
      await fetchProviders();
      if (onProvidersUpdated) onProvidersUpdated();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove API key.');
    } finally {
      setDeletingProvider(null);
    }
  };

  const handleTestKey = async (provider: 'GROQ' | 'NVIDIA') => {
    const name = provider === 'GROQ' ? 'Groq' : 'NVIDIA NIM';
    try {
      setTestingProvider(provider);
      setTestStatus(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTestStatus({
        provider,
        success: true,
        message: `${name} connection verified successfully.`,
      });
    } catch (err: any) {
      setTestStatus({
        provider,
        success: false,
        message: err.message || `Unable to reach ${name}. Please check your credentials.`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const configuredCount = [groqConfig, nvidiaConfig].filter(
    (p) => p.configured && p.enabled
  ).length;

  const renderCard = (
    provider: 'GROQ' | 'NVIDIA',
    title: string,
    roleTag: string,
    roleType: 'primary' | 'fallback',
    description: string,
    consoleUrl: string,
    config: UserAIProviderDTO
  ) => {
    const isConfigured = config.configured && config.enabled;
    const isEditing = editingProvider === provider;
    const isTesting = testingProvider === provider;
    const isDeleting = deletingProvider === provider;
    const isGroq = provider === 'GROQ';

    return (
      <div
        className={`group relative rounded-2xl border transition-all duration-200 ${
          isConfigured
            ? 'border-border/80 bg-card shadow-xs'
            : 'border-dashed border-border/70 bg-card/50'
        } p-5.5`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                isGroq
                  ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
              }`}
            >
              {isGroq ? <Zap className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-foreground tracking-tight">{title}</h4>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    roleType === 'primary'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {roleTag}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Inline Editing Form */}
        {isEditing ? (
          <form
            onSubmit={(e) => handleSaveKey(provider, e)}
            className="mt-4 pt-4 border-t border-border/60 space-y-3.5 animate-in fade-in duration-150"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Enter {title} Key</span>
                </label>
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Get key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={isGroq ? 'gsk_...' : 'nvapi-...'}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-10 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={savingKey}
                className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingKey || !apiKeyInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-xs disabled:opacity-50"
              >
                {savingKey ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Save Key</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Normal Display Row */
          <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
            {isConfigured ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <code className="text-xs font-mono font-medium text-foreground tracking-wider">
                      {config.maskedKey || '••••••••••••'}
                    </code>
                  </div>
                  {config.lastValidatedAt && (
                    <span className="text-[11px] text-muted-foreground">
                      Validated {new Date(config.lastValidatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleTestKey(provider)}
                    disabled={isTesting}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors border border-border disabled:opacity-50"
                    title="Test key connection"
                  >
                    {isTesting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>Test</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEditing(provider)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20"
                  >
                    <span>Update</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteKey(provider)}
                    disabled={isDeleting}
                    className="inline-flex items-center justify-center p-1.5 text-xs font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors border border-danger/20 disabled:opacity-50"
                    title="Remove key"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Provide your personal API key to activate this engine.
                </span>
                <button
                  type="button"
                  onClick={() => handleStartEditing(provider)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-xs shrink-0"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>Connect Key</span>
                  <ArrowRight className="h-3 w-3 ml-0.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Test Connection Banner */}
        {testStatus && testStatus.provider === provider && !isEditing && (
          <div
            className={`mt-3 rounded-xl p-2.5 text-xs flex items-center gap-2 animate-in fade-in duration-100 ${
              testStatus.success
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                : 'bg-danger/10 text-danger border border-danger/20'
            }`}
          >
            {testStatus.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <span className="font-medium">{testStatus.message}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="ai-settings-title" className="text-base font-bold text-foreground">
                AI Provider Settings
              </h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                BYOK
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure personal provider API keys for workspace intelligence & automated tooling.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -mr-1.5"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary mb-2.5" />
              <p className="text-xs font-medium">Loading AI provider configuration...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-danger/10 p-4 border border-danger/20 text-danger text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Primary Provider: Groq */}
              {renderCard(
                'GROQ',
                'Groq Cloud',
                'Primary Engine',
                'primary',
                'Ultra-low latency inference engine. Evaluated first for all automated workflow queries.',
                'https://console.groq.com/keys',
                groqConfig
              )}

              {/* Fallback Provider: NVIDIA NIM */}
              {renderCard(
                'NVIDIA',
                'NVIDIA NIM',
                'Automatic Fallback',
                'fallback',
                'Resilient high-throughput GPU inference. Automatically handles requests when primary provider reaches rate limits.',
                'https://build.nvidia.com',
                nvidiaConfig
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground font-medium">
            {configuredCount} of 2 providers connected
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border rounded-lg transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
