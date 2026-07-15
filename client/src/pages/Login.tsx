import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../common/Card';
import { authService } from '../services/auth.service';
import { setCredentials, setLoading, setError } from '../features/auth/authSlice';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or register number is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const [localError, setLocalError] = useState<string | null>(null);
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
      // Redirect to forced password change screen if required
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
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Sign in to ProjectVerse</CardTitle>
        <CardDescription className="text-center">
          Enter your email or register number to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="identifier">
              Email or Register Number
            </label>
            <Input
              id="identifier"
              type="text"
              placeholder="m@example.com or your reg. number"
              {...register('identifier')}
            />
            {errors.identifier && <p className="text-sm text-danger">{errors.identifier.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
          </div>
          {localError && <div className="text-sm text-danger text-center font-medium">{localError}</div>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground w-full">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};
