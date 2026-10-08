import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, setUnauthorizedHandler } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api("/auth/me");
      setState({ loading: false, user });
    } catch {
      setState({ loading: false, user: null });
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setState({ loading: false, user: null }));
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setState({ loading: false, user: null });
  }, []);

  const setUser = useCallback((user) => setState({ loading: false, user }), []);

  return (
    <AuthContext.Provider value={{ ...state, refresh, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
