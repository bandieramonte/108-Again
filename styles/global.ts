import { StyleSheet } from "react-native";

export const APP_SIDE_PADDING = 14;
export const APP_MAX_CONTENT_WIDTH = 800;
const FORM_PRIMARY = "#1A5FCC";

export const globalStyles = StyleSheet.create({
  screen: {
    width: "100%",
    maxWidth: APP_MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingHorizontal: APP_SIDE_PADDING,
    paddingTop: 20,
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
    color: "#111",
    marginBottom: 20,
  },

  formSectionCard: {
    borderWidth: 1,
    borderColor: "#E1E7F5",
    backgroundColor: "#FAFBFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },

  formSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },

  formSectionDescription: {
    fontSize: 13,
    color: "#667085",
    marginBottom: 12,
    lineHeight: 18,
  },

  formInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
    marginBottom: 6,
  },

  formInput: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    padding: 11,
    marginBottom: 12,
    color: "black",
    borderRadius: 10,
    backgroundColor: "white",
  },

  formReadOnlyInput: {
    backgroundColor: "#F2F4F7",
    color: "#667085",
  },

  formOptionPressed: {
    opacity: 0.72,
  },

  formSaveButton: {
    backgroundColor: FORM_PRIMARY,
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
    color: "#111",
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
    borderColor: "#E1E7F5",
    borderRadius: 14,
    backgroundColor: "white",
    padding: 9,
  },

  formSelectedImageOption: {
    borderColor: FORM_PRIMARY,
    backgroundColor: "#EEF2FF",
  },

  formImageOptionImage: {
    width: 42,
    height: 42,
    borderRadius: 9,
  },

  formImageOptionText: {
    flex: 1,
    minWidth: 0,
    color: "#111",
    fontSize: 13,
    fontWeight: "600",
  },
});
