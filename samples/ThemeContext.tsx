import { createContext } from "react";

export const ThemeContext = createContext<"light" | "dark">("light");
