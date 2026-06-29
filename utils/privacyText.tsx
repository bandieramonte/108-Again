import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/locales/en";

const privacySections: {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}[] = [
  {
    titleKey: "privacy.controllerTitle",
    bodyKey: "privacy.controllerText",
  },
  {
    titleKey: "privacy.dataWeCollectTitle",
    bodyKey: "privacy.dataWeCollectText",
  },
  {
    titleKey: "privacy.offlineUseTitle",
    bodyKey: "privacy.offlineUseText",
  },
  {
    titleKey: "privacy.howWeUseTitle",
    bodyKey: "privacy.howWeUseText",
  },
  {
    titleKey: "privacy.dataStorageTitle",
    bodyKey: "privacy.dataStorageText",
  },
  {
    titleKey: "privacy.dataSharingTitle",
    bodyKey: "privacy.dataSharingText",
  },
  {
    titleKey: "privacy.dataRetentionTitle",
    bodyKey: "privacy.dataRetentionText",
  },
  {
    titleKey: "privacy.yourRightsTitle",
    bodyKey: "privacy.yourRightsText",
  },
  {
    titleKey: "privacy.accountDeletionTitle",
    bodyKey: "privacy.accountDeletionText",
  },
  {
    titleKey: "privacy.internationalUsersTitle",
    bodyKey: "privacy.internationalUsersText",
  },
  {
    titleKey: "privacy.changesTitle",
    bodyKey: "privacy.changesText",
  },
  {
    titleKey: "privacy.lastUpdatedTitle",
    bodyKey: "privacy.lastUpdatedText",
  },
];

export function PrivacyContent() {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {t("privacy.title")}
      </Text>

      <Text style={styles.text}>
        {t("privacy.intro")}
      </Text>

      {privacySections.map(section => (
        <React.Fragment key={section.titleKey}>
          <Text style={styles.heading}>
            {t(section.titleKey)}
          </Text>

          <Text style={styles.text}>
            {t(section.bodyKey)}
          </Text>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 30,
  },
  heading: {
    fontWeight: "600",
    fontSize: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
