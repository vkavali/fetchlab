import { createContext, useContext, type Dispatch } from 'react';
import type { Action, AppState } from './AppContext';

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  sendRequest: (requestId: string) => Promise<void>;
  fetchOAuth2Token: (requestId: string) => Promise<void>;
  fetchTokenProfile: (profileId: string) => Promise<void>;
  getEnvVariables: () => Record<string, string>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

