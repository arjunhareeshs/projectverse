import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Eye, EyeOff } from 'lucide-react';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { authService } from '../services/auth.service';
import { setCredentials, setLoading, setError } from '../features/auth/authSlice';
import loginAssetImg from '../assets/loginasset.png';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or register number is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { isAuthenticated, user } = useSelector((state: any) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        navigate('/admin/upload');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setLocalError(null);
      dispatch(setLoading(true));
      const response = await authService.login(data);
      dispatch(setCredentials({ user: response.user, token: response.token }));

      if (response.user.role === 'ADMIN') {
        navigate('/admin/upload');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid credentials';
      setLocalError(msg);
      dispatch(setError(msg));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="w-full max-w-[1020px] bg-white rounded-[32px] shadow-[0_25px_70px_rgba(0,0,0,0.08),0_10px_35px_rgba(124,58,237,0.08)] overflow-hidden flex flex-col md:flex-row border border-white/70 transition-all duration-300">
      
      {/* ─── Left Column: 3D Render Asset with Glow / Bloom ─── */}
      <div className="w-full md:w-[48%] lg:w-[49%] relative bg-[#ECEEF2] min-h-[320px] md:min-h-[640px] flex items-center justify-center overflow-hidden group">
        <img
          src={loginAssetImg}
          alt="ProjectVerse 3D Visualization"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {/* Subtle glowing ambient bloom overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/10 via-transparent to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* ─── Right Column: Login Form ─── */}
      <div className="w-full md:w-[52%] lg:w-[51%] p-8 sm:p-10 md:p-12 lg:p-14 flex flex-col justify-center bg-white">
        
        {/* Logo and Brand Title */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7B2CBF] via-[#3A0CA3] to-[#4361EE] flex items-center justify-center shadow-[0_4px_12px_rgba(123,44,191,0.35)]">
            <span className="text-white font-extrabold text-base tracking-tighter">P</span>
          </div>
          <span className="text-xl font-bold text-[#0F172A] tracking-tight">
            Project<span className="text-[#6D28D9]">Verse</span>
          </span>
        </div>

        {/* Heading */}
        <div className="mb-7">
          <h1 className="text-3xl font-extrabold text-[#0B0F19] tracking-tight">
            Welcome Back!
          </h1>
          <p className="text-sm text-[#64748B] mt-1 font-normal">
            Enter your details to continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Email / Identifier Field */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1.5" htmlFor="identifier">
              Email
            </label>
            <div className="relative flex items-center">
              <input
                id="identifier"
                type="text"
                placeholder="Enter your email"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition-all duration-200 focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10 hover:border-[#CBD5E1] shadow-sm pr-11"
                {...register('identifier')}
              />
              <Mail className="w-5 h-5 text-[#94A3B8] absolute right-3.5 pointer-events-none" />
            </div>
            {errors.identifier && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.identifier.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-[#1E293B] mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition-all duration-200 focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10 hover:border-[#CBD5E1] shadow-sm pr-11"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-[#94A3B8] hover:text-[#475569] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#6D28D9] focus:ring-[#6D28D9]/20 accent-[#6D28D9] cursor-pointer"
              />
              <span className="text-sm font-medium text-[#475569]">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#6D28D9] hover:text-[#5B21B6] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error Message */}
          {localError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 text-center font-medium">
              {localError}
            </div>
          )}

          {/* Submit Button with Bloom Hover Effect */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-[#181145] hover:bg-[#22165c] transition-all duration-300 shadow-md hover:shadow-[0_0_25px_rgba(109,40,217,0.5)] hover:scale-[1.008] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Log in</span>
            )}
          </button>
        </form>

        {/* Divider with 'or' */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-[#E2E8F0] w-full" />
          <span className="bg-white px-3 text-xs lowercase tracking-wider text-[#94A3B8] font-medium shrink-0">
            or
          </span>
          <div className="border-t border-[#E2E8F0] w-full" />
        </div>

        {/* Google Sign-In Button with matching styling & bloom hover */}
        <GoogleSignInButton
          text="Log in with Google"
          onError={(msg) => setLocalError(msg)}
          disabled={isSubmitting}
        />

        {/* Footer: Sign Up Link */}
        <div className="mt-8 text-center text-sm text-[#64748B]">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-bold text-[#6D28D9] hover:text-[#5B21B6] hover:underline transition-colors ml-1"
          >
            Sign up
          </Link>
        </div>

      </div>
    </div>
  );
};
