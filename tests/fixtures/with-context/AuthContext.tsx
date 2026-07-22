import { createContext } from "react";

export const AuthContext = createContext<{ user: string | null }>({ user: null });
