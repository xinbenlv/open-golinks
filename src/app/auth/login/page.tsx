'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { getSupabaseBrowserClient } from '@/lib/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const [isLoading, setIsLoading] = useState(true);

  // JUSTIFICATION: useEffect is necessary because:
  // 1. We need to check authentication status on client-side after component mounts
  // 2. Cannot determine auth state during server render (SSR limitation)
  // Alternative considered: Server Component auth check, but auth state is only available in browser via onAuthStateChange
  useEffect(() => {
    // Check if already authenticated and redirect
    const checkAuthAndRedirect = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Already logged in, redirect to returnTo
          router.push(returnTo);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndRedirect();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(returnTo);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [returnTo, router, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-md w-full p-8 text-center">
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Open GoLinks</h1>
          <p className="text-center text-sm text-gray-600 mb-8">登录到你的账户</p>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',
                    brandAccent: '#1d4ed8',
                  },
                },
              },
            }}
            providers={['google']}
            redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
          />

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-600 mb-3">支持的登录方式：</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="mr-2">📧</span>
                <span>Magic Link（发送登录链接到邮箱）</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">🔑</span>
                <span>邮箱 + 密码登录</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2">🌐</span>
                <span>Google 账号一键登录</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          登录即表示同意我们的服务条款
        </p>
      </div>
    </div>
  );
}
