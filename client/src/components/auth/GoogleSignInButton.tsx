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
}) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
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
    if (!scriptLoaded || !isClientIdConfigured || !buttonContainerRef.current) return;

    try {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      buttonContainerRef.current.innerHTML = '';
      window.google?.accounts.id.renderButton(buttonContainerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 380,
      });
    } catch (err) {
      console.error('Failed to initialize Google Sign-In button:', err);
    }
  }, [scriptLoaded, isClientIdConfigured, clientId]);

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

  if (!isClientIdConfigured) {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
        Google Sign-In is not configured. Please add a valid <code>VITE_GOOGLE_CLIENT_ID</code> in your client <code>.env</code>.
      </div>
    );
  }

  return (
    <div
      className={`w-full flex justify-center items-center min-h-[44px] transition-opacity duration-200 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div
        ref={buttonContainerRef}
        className="w-full flex justify-center [&>div]:!w-full [&_iframe]:!w-full"
      />
    </div>
  );
};

