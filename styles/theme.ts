import { ViewStyle } from "react-native";

export const colors = {
  primary: "#1A5FCC",
  accent: "#044ECC",
  textPrimary: "#111",
  textSecondary: "#666",
  background: "#ffffff",
  surface: "#f3f4f6",
  border: "#1A5FCC",
  success: "#16a34a"
};

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
  screen: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20
  }
};