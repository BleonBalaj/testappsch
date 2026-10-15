import { createContext, useContext } from 'react';

export const AppReleaseContext = createContext(null);
export function useAppRelease() { return useContext(AppReleaseContext); }
