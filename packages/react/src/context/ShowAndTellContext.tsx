import React, { createContext, useContext } from 'react';
import { useShowAndTell } from '../hooks/useShowAndTell';
import type { ShowAndTellProviderProps, UseShowAndTellReturn } from '../types';

export const ShowAndTellContext = createContext<UseShowAndTellReturn | null>(null);

/**
 * React Context Provider allowing components anywhere in your application tree
 * to observe recording state and trigger recordings without prop drilling.
 */
export const ShowAndTellProvider: React.FC<ShowAndTellProviderProps> = ({
  children,
  ...options
}) => {
  const value = useShowAndTell(options);

  return (
    <ShowAndTellContext.Provider value={value}>
      {children}
    </ShowAndTellContext.Provider>
  );
};

/**
 * Access the shared ShowAndTell recording context from any descendant component.
 */
export function useShowAndTellContext(): UseShowAndTellReturn {
  const context = useContext(ShowAndTellContext);
  if (!context) {
    throw new Error(
      'useShowAndTellContext must be used within a <ShowAndTellProvider>. ' +
      'Wrap your component tree in <ShowAndTellProvider> or use useShowAndTell() directly.'
    );
  }
  return context;
}
