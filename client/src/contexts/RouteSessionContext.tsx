import React, { createContext, useContext, ReactNode } from 'react';
import { useRouteSession, RouteSessionState } from '../hooks/useRouteSession';
import { RouteSession as RouteSessionType } from '@shared/types';

interface RouteSessionContextType extends RouteSessionState {
  startSession: (empId?: string) => Promise<RouteSessionType>;
  stopSession: () => Promise<RouteSessionType>;
  pauseSession: () => Promise<RouteSessionType>;
  resumeSession: () => Promise<RouteSessionType>;
  clearError: () => void;
  getSessionSummary: () => any;
  canStartSession: () => boolean;
  canStopSession: () => boolean;
  canPauseSession: () => boolean;
  canResumeSession: () => boolean;
  getFormattedDuration: () => string;
  getFormattedDistance: () => string;
  getFormattedSpeed: () => string;
  confirmGeofenceStop: () => Promise<void>;
  cancelGeofenceStop: () => void;
}

const RouteSessionContext = createContext<RouteSessionContextType | undefined>(undefined);

interface RouteSessionProviderProps {
  children: ReactNode;
  employee_id?: string;
}

export function RouteSessionProvider({ children, employee_id }: RouteSessionProviderProps) {
  const session = useRouteSession({ employee_id });

  return (
    <RouteSessionContext.Provider value={session}>
      {children}
    </RouteSessionContext.Provider>
  );
}

export function useRouteSessionContext() {
  const context = useContext(RouteSessionContext);
  if (context === undefined) {
    throw new Error('useRouteSessionContext must be used within a RouteSessionProvider');
  }
  return context;
}
