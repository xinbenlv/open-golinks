// 认证相关类型定义

export interface AuthSession {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
}

export interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
}
