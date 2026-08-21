import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../../services/auth.service';
import { useDispatch } from 'react-redux';
import { setCredentials, setError, setLoading } from '../../features/auth/authSlice';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt?: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  text?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  text = 'Log in with Google',
}) => {
  const hiddenButtonRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isClientIdConfigured =
    Boolean(clientId) &&
    clientId !== 'your-google-client-id.apps.googleusercontent.com' &&
    clientId.includes('.apps.googleusercontent.com');

  const handleCredentialResponse = async (response: { credential: string }) => {
    if (!response.credential) {
      const errMsg = 'No credential received from Google';
      onError?.(errMsg);
      dispatch(setError(errMsg));
      return;
    }

    try {
      setIsProcessing(true);
      dispatch(setLoading(true));

      const authData = await authService.googleLogin(response.credential);

      dispatch(setCredentials({ user: authData.user, token: authData.token }));

      if (onSuccess) {
        onSuccess(authData.user);
      } else {
        if (authData.user?.role === 'ADMIN') {
          navigate('/admin/upload');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Google login backend error:', err);
      const errMsg =
        err.response?.data?.message || 'Failed to authenticate with Google. Please try again.';
      onError?.(errMsg);
      dispatch(setError(errMsg));
    } finally {
      setIsProcessing(false);
      dispatch(setLoading(false));
    }
  };

  useEffect(() => {
    const checkGsi = () => {
      if (window.google?.accounts?.id) {
        setScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGsi()) return;

    const interval = setInterval(() => {
      if (checkGsi()) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !isClientIdConfigured) return;

    try {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (hiddenButtonRef.current) {
        hiddenButtonRef.current.innerHTML = '';
        window.google?.accounts.id.renderButton(hiddenButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: '380',
        });
      }
    } catch (err) {
      console.error('Failed to initialize Google Sign-In button:', err);
    }
  }, [scriptLoaded, isClientIdConfigured, clientId]);

  const handleCustomButtonClick = () => {
    if (disabled || isProcessing) return;

    if (!isClientIdConfigured) {
      const msg = 'Google Sign-In requires a valid VITE_GOOGLE_CLIENT_ID in your client .env file.';
      onError?.(msg);
      dispatch(setError(msg));
      return;
    }

    // Trigger Google Prompt or find iframe inside hidden ref
    if (window.google?.accounts?.id?.prompt) {
      window.google.accounts.id.prompt();
    }

    const googleBtn = hiddenButtonRef.current?.querySelector('div[role="button"]') as HTMLElement;
    if (googleBtn) {
      googleBtn.click();
    }
  };

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4 w-full border border-purple-200 rounded-xl bg-purple-50/50 text-[#1E114D] text-sm font-medium shadow-sm animate-pulse">
        <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span>Authenticating with Google...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Hidden native Google button container for credential callback attachment */}
      <div
        ref={hiddenButtonRef}
        className="absolute inset-0 opacity-0 pointer-events-auto z-10 overflow-hidden cursor-pointer flex items-center justify-center"
      />

      {/* Styled custom button matching the UI mockup with bloom hover effect */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleCustomButtonClick}
        className="relative z-0 w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#FAF5FF]/40 text-[#0F172A] font-medium text-sm transition-all duration-300 shadow-sm hover:border-purple-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.18)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
      >
        <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="font-semibold text-[#1E293B] group-hover:text-[#0F172A] transition-colors">
          {text}
        </span>
      </button>
    </div>
  );
};
