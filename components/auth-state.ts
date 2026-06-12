"use client";

import { useSyncExternalStore } from "react";

export type DakeUser = {
  id?: number;
  email?: string;
  nickname?: string;
  credits?: number;
  status?: number;
  has_recharged?: boolean;
  created_at?: string;
  last_login_at?: string | null;
};

const AUTH_EVENT = "dake-auth-change";

function subscribeAuth(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function authTokenSnapshot() {
  return getStoredToken();
}

function authUserSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("dake_user") || "";
}

function clientReadySnapshot() {
  return typeof window === "undefined" ? "" : "ready";
}

export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("dake_token") || "";
}

export function getStoredUser(): DakeUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("dake_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DakeUser;
  } catch {
    return null;
  }
}

export function useAuthToken() {
  return useSyncExternalStore(subscribeAuth, authTokenSnapshot, () => "");
}

export function useClientReady() {
  return useSyncExternalStore(() => () => {}, clientReadySnapshot, () => "");
}

export function useAuthUser() {
  const raw = useSyncExternalStore(subscribeAuth, authUserSnapshot, () => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DakeUser;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getStoredToken());
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("dake_token");
  window.localStorage.removeItem("dake_user");
  notifyAuthChanged();
}
