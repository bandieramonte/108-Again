import { StyleSheet } from "react-native";

export const APP_SIDE_PADDING = 14;
export const APP_MAX_CONTENT_WIDTH = 800;

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
});
