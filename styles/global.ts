import { StyleSheet } from "react-native";

export const APP_SIDE_PADDING = 14;
export const APP_MAX_CONTENT_WIDTH = 800;
const FORM_PRIMARY = "#1A5FCC";

export type GlobalStyleColors = {
  primary: string;
  textPrimary: string;
  textSecondary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSelected: string;
  borderSubtle: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  inputReadOnlyBackground: string;
  inputReadOnlyText: string;
};

const lightGlobalColors: GlobalStyleColors = {
  primary: FORM_PRIMARY,
  textPrimary: "#111",
  textSecondary: "#667085",
  background: "#ffffff",
  surface: "#f3f4f6",
  surfaceElevated: "#FAFBFF",
  surfaceSelected: "#EEF2FF",
  borderSubtle: "#E1E7F5",
  inputBackground: "#ffffff",
  inputBorder: "#D0D5DD",
  inputText: "#000000",
  inputPlaceholder: "#999999",
  inputReadOnlyBackground: "#F2F4F7",
  inputReadOnlyText: "#667085",
};

export function createGlobalStyles(colors: GlobalStyleColors) {
  return StyleSheet.create({
  screen: {
    width: "100%",
    maxWidth: APP_MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingHorizontal: APP_SIDE_PADDING,
    paddingTop: 20,
    backgroundColor: colors.background,
  },

  sidePadding: {
    paddingHorizontal: APP_SIDE_PADDING,
  },

  formScreen: {
    flexGrow: 1,
    paddingTop: 26,
    paddingBottom: 36,
  },

  formTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 20,
  },

  formSectionCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },

  formSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },

  formSectionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },

  formInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
  },

  formInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 11,
    marginBottom: 12,
    color: colors.inputText,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
  },

  formReadOnlyInput: {
    backgroundColor: colors.inputReadOnlyBackground,
    color: colors.inputReadOnlyText,
  },

  formOptionPressed: {
    opacity: 0.72,
  },

  formSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 2,
  },

  formSaveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  formImagePicker: {
    marginTop: 4,
  },

  formImagePickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },

  formImageOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  formImageOption: {
    width: "47%",
    minWidth: 120,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    backgroundColor: colors.inputBackground,
    padding: 9,
  },

  formSelectedImageOption: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },

  formImageOptionImage: {
    width: 42,
    height: 42,
    borderRadius: 9,
  },

  formImageOptionText: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  });
}

export const globalStyles = createGlobalStyles(lightGlobalColors);
