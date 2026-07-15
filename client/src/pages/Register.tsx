import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../common/Card';
import { authService } from '../services/auth.service';
import { setCredentials, setLoading, setError } from '../features/auth/authSlice';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      setLocalError(null);
      dispatch(setLoading(true));
      const response = await authService.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      // Optionally login automatically after register
      dispatch(setCredentials({ user: response.user, token: response.token }));
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setLocalError(msg);
      dispatch(setError(msg));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Create an account</CardTitle>
        <CardDescription className="text-center">
          Enter your information to get started with ProjectVerse
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="fullName">
              Full Name
            </label>
            <Input
              id="fullName"
              placeholder="John Doe"
              {...register('fullName')}
            />
            {errors.fullName && <p className="text-sm text-danger">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="text-sm text-danger">{errors.confirmPassword.message}</p>}
          </div>
          {localError && <div className="text-sm text-danger text-center font-medium">{localError}</div>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground w-full">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};
