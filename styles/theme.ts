import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme, ViewStyle } from "react-native";
import {
  createGlobalStyles,
  globalStyles,
  type GlobalStyleColors,
} from "./global";

export type AppThemeName = "light" | "dark";
export type AppThemePreference = AppThemeName | "system";

export type AppThemeColors = GlobalStyleColors & {
  accent: string;
  border: string;
  borderStrong: string;
  headerBackground: string;
  headerBorder: string;
  icon: string;
  iconMuted: string;
  destructive: string;
  destructiveSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  overlay: string;
  shadow: string;
  progressTrack: string;
  quickAddSurface: string;
  quickAddBorder: string;
  tooltipBackground: string;
};

const THEME_STORAGE_KEY = "preferredTheme";

export const lightColors: AppThemeColors = {
  primary: "#1A5FCC",
  accent: "#044ECC",
  textPrimary: "#111",
  textSecondary: "#666",
  background: "#ffffff",
  surface: "#f3f4f6",
  surfaceElevated: "#FAFBFF",
  surfaceSelected: "#EEF2FF",
  border: "#1A5FCC",
  borderStrong: "#CBD5E1",
  borderSubtle: "#E1E7F5",
  headerBackground: "#ffffff",
  headerBorder: "#E5E7EB",
  icon: "#222222",
  iconMuted: "#666666",
  inputBackground: "#ffffff",
  inputBorder: "#D0D5DD",
  inputText: "#000000",
  inputPlaceholder: "#999999",
  inputReadOnlyBackground: "#F2F4F7",
  inputReadOnlyText: "#667085",
  destructive: "#c62828",
  destructiveSurface: "#ffebee",
  success: "#16a34a",
  successSurface: "#e6f4ea",
  warning: "#f59e0b",
  overlay: "rgba(0,0,0,0.35)",
  shadow: "#000000",
  progressTrack: "#E8EDF7",
  quickAddSurface: "#EEF2FF",
  quickAddBorder: "#DBE4FF",
  tooltipBackground: "#111111",
};

export const darkColors: AppThemeColors = {
  primary: "#6EA8FF",
  accent: "#8BB9FF",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  background: "#0B1120",
  surface: "#111827",
  surfaceElevated: "#172033",
  surfaceSelected: "#1D3A66",
  border: "#6EA8FF",
  borderStrong: "#3B4A63",
  borderSubtle: "#2A3648",
  headerBackground: "#0B1120",
  headerBorder: "#1F2937",
  icon: "#F8FAFC",
  iconMuted: "#CBD5E1",
  inputBackground: "#111827",
  inputBorder: "#334155",
  inputText: "#F8FAFC",
  inputPlaceholder: "#94A3B8",
  inputReadOnlyBackground: "#1F2937",
  inputReadOnlyText: "#94A3B8",
  destructive: "#F87171",
  destructiveSurface: "#3B171B",
  success: "#4ADE80",
  successSurface: "#14351F",
  warning: "#FBBF24",
  overlay: "rgba(0,0,0,0.55)",
  shadow: "#000000",
  progressTrack: "#1F2A3D",
  quickAddSurface: "#16233B",
  quickAddBorder: "#2B3E5F",
  tooltipBackground: "#F8FAFC",
};

export const themePalettes: Record<AppThemeName, AppThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

export const colors = lightColors;

export const typography = {
  header: {
    fontSize: 22,
    fontWeight: "600"
  },

  title: {
    fontSize: 18,
    fontWeight: "600"
  },

  body: {
    fontSize: 14
  },

  caption: {
    fontSize: 12,
    color: "#666"
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  round: 999
};

export const containers: {
  screen: ViewStyle;
} = {
  screen: globalStyles.screen
};

type AppThemeContextValue = {
  themeName: AppThemeName;
  themePreference: AppThemePreference;
  colors: AppThemeColors;
  isDark: boolean;
  setTheme: (themeName: AppThemeName) => Promise<void>;
  setThemePreference: (themePreference: AppThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue>({
  themeName: "light",
  themePreference: "system",
  colors: lightColors,
  isDark: false,
  setTheme: async () => {},
  setThemePreference: async () => {},
  toggleTheme: async () => {},
});

function normalizeThemeName(value: string | null | undefined): AppThemeName {
  return value === "dark" ? "dark" : "light";
}

function normalizeThemePreference(value: string | null): AppThemePreference {
  if (value === "dark" || value === "light" || value === "system") {
    return value;
  }

  return "system";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<AppThemePreference>("system");

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (!active) return;
        setThemePreferenceState(normalizeThemePreference(storedTheme));
      })
      .catch((error) => {
        console.warn("Failed to load theme preference", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const systemThemeName = normalizeThemeName(systemColorScheme);
  const themeName =
    themePreference === "system" ? systemThemeName : themePreference;

  const setThemePreference = useCallback(
    async (nextThemePreference: AppThemePreference) => {
      setThemePreferenceState(nextThemePreference);
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, nextThemePreference);
      } catch (error) {
        console.warn("Failed to save theme preference", error);
      }
    },
    []
  );

  const setTheme = useCallback(
    async (nextThemeName: AppThemeName) => {
      await setThemePreference(nextThemeName);
    },
    [setThemePreference]
  );

  const toggleTheme = useCallback(async () => {
    const nextThemeName = themeName === "dark" ? "light" : "dark";
    await setTheme(nextThemeName);
  }, [setTheme, themeName]);

  const value = useMemo<AppThemeContextValue>(() => {
    const palette = themePalettes[themeName];

    return {
      themeName,
      themePreference,
      colors: palette,
      isDark: themeName === "dark",
      setTheme,
      setThemePreference,
      toggleTheme,
    };
  }, [
    setTheme,
    setThemePreference,
    themeName,
    themePreference,
    toggleTheme,
  ]);

  return React.createElement(
    AppThemeContext.Provider,
    { value },
    children
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}

export function useGlobalStyles() {
  const { colors: themeColors } = useAppTheme();

  return useMemo(
    () => createGlobalStyles(themeColors),
    [themeColors]
  );
}
