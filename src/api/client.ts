import { createContext, useContext } from 'react';
import { DemoApi } from './demo';
import { HttpApi } from './http';
import type { Api } from './types';

/** VITE_API_URL points at a running sprint-planner-api. Without it the app runs in demo mode. */
export function createApi(apiUrl: string | undefined = import.meta.env.VITE_API_URL): Api {
  return apiUrl ? new HttpApi(apiUrl) : new DemoApi();
}

export const ApiContext = createContext<Api | null>(null);

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiContext.Provider>');
  return api;
}
