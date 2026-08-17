// src/services/api.ts
// Axios instance with silent refresh interceptor.
// Handles:
//   - Attaching Bearer token from SecureStore
//   - On 401: queues concurrent requests, refreshes token, replays all
//   - Prevents duplicate refresh calls via isRefreshing flag

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolve the API base URL based on the environment.
 * Priority: env var → Expo dev server host → platform default
 */
function getBaseURL(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri;
    const hostIp = debuggerHost ? debuggerHost.split(':')[0] : null;

    if (Platform.OS === 'android') {
      return hostIp ? `http://${hostIp}:3001` : 'http://10.0.2.2:3001';
    }
    // iOS simulator can use localhost; physical device needs LAN IP
    return hostIp ? `http://${hostIp}:3001` : 'http://localhost:3001';
  }

  return 'https://api.wevsocial.com';
}

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Silent Refresh Machinery ─────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });
  failedQueue = [];
}

// Request interceptor: attach access token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Call refresh endpoint directly (not through the intercepted instance)
      const { data } = await axios.post(`${getBaseURL()}/api/auth/refresh`, {
        refreshToken,
      });

      const newAccessToken: string = data.data.accessToken;
      const newRefreshToken: string = data.data.refreshToken;

      await SecureStore.setItemAsync('access_token', newAccessToken);
      await SecureStore.setItemAsync('refresh_token', newRefreshToken);

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Clear tokens — user must re-authenticate
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
