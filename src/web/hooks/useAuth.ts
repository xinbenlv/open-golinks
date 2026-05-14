import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getAuthRedirectUrl,
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
};

type AuthSubscriber = (state: AuthState) => void;

const subscribers = new Set<AuthSubscriber>();

let initialized = false;
let state: AuthState = {
  user: null,
  session: null,
  loading: Boolean(supabase),
  error: isSupabaseConfigured ? null : "Supabase client env is not configured.",
};

function emit(next: AuthState) {
  state = next;
  for (const subscriber of subscribers) subscriber(state);
}

function initAuthStore() {
  if (initialized || !supabase) return;
  initialized = true;

  void supabase.auth
    .getSession()
    .then(({ data, error }) => {
      emit({
        user: data.session?.user ?? null,
        session: data.session ?? null,
        loading: false,
        error: error?.message ?? null,
      });
    })
    .catch((err: unknown) => {
      emit({
        user: null,
        session: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load session.",
      });
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    emit({
      user: session?.user ?? null,
      session,
      loading: false,
      error: null,
    });
  });
}

function subscribe(subscriber: AuthSubscriber) {
  subscribers.add(subscriber);
  subscriber(state);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function useAuth() {
  const [current, setCurrent] = useState<AuthState>(state);

  useEffect(() => {
    initAuthStore();
    return subscribe(setCurrent);
  }, []);

  async function signInWithMagicLink(email: string) {
    if (!supabase) {
      throw new Error("Supabase client env is not configured.");
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return {
    ...current,
    configured: isSupabaseConfigured,
    signInWithMagicLink,
    signOut,
  };
}

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
