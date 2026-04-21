import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function PrivacyContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Privacy & Data Protection (GDPR)
      </Text>

      <Text style={styles.text}>
        108 Again respects your privacy and is committed to protecting your personal data.
      </Text>

      <Text style={styles.heading}>
        Data Controller
      </Text>

      <Text style={styles.text}>
        108 Again is operated by an independent developer.
        {"\n\n"}
        Contact:
        {"\n"}
        Email: gian@bandieramonte.com
      </Text>

      <Text style={styles.heading}>
        Data We Collect
      </Text>

      <Text style={styles.text}>
        When you create an account, we collect:
        {"\n\n"}
        • Email address{"\n"}
        • Authentication credentials (handled securely by Supabase Authentication){"\n"}
        • Practice data (practices and sessions)
        {"\n\n"}
        If you use the app without an account, your data remains stored locally on your device only.
      </Text>

      <Text style={styles.heading}>
        Offline Use
      </Text>

      <Text style={styles.text}>
        You may use this app without creating an account. When used without an account, all data remains stored locally on your device and is not transmitted to any server.
      </Text>

      <Text style={styles.heading}>
        How We Use Your Data
      </Text>

      <Text style={styles.text}>
        Your data is used only to:
        {"\n\n"}
        • Provide synchronization between devices{"\n"}
        • Store your practice progress{"\n"}
        • Authenticate your account
        {"\n\n"}
        We do not:
        {"\n\n"}
        • Sell your data{"\n"}
        • Use your data for advertising{"\n"}
        • Use analytics or tracking technologies{"\n"}
        • Share your data with third parties except infrastructure providers
      </Text>

      <Text style={styles.heading}>
        Data Storage
      </Text>

      <Text style={styles.text}>
        Your data is stored:
        {"\n\n"}
        • Locally on your device{"\n"}
        • Securely in Supabase cloud infrastructure
        {"\n\n"}
        Supabase uses industry-standard encryption and security practices.
      </Text>

      <Text style={styles.heading}>
        Data Sharing
      </Text>

      <Text style={styles.text}>
        We do not share your data with third parties except for infrastructure providers necessary to operate the app.
        {"\n\n"}
        Infrastructure providers:
        {"\n"}
        • Supabase (database and authentication){"\n"}
        • Expo (app infrastructure){"\n"}
        • Apple App Store / Google Play (app distribution)
      </Text>

      <Text style={styles.heading}>
        Data Retention
      </Text>

      <Text style={styles.text}>
        Your data is stored until:
        {"\n\n"}
        • You delete your account{"\n"}
        • You delete your practices{"\n"}
        • You request deletion
        {"\n\n"}
        Deleted data may remain temporarily for backup and synchronization purposes.
      </Text>

      <Text style={styles.heading}>
        Your Rights (GDPR)
      </Text>

      <Text style={styles.text}>
        If you are located in the European Economic Area, you have the right to:
        {"\n\n"}
        • Access your data{"\n"}
        • Correct your data{"\n"}
        • Delete your data{"\n"}
        • Export your data{"\n"}
        • Withdraw consent
        {"\n\n"}
        You may delete your account directly in the app or contact the developer for assistance.
      </Text>

      <Text style={styles.heading}>
        Account Deletion
      </Text>

      <Text style={styles.text}>
        You may delete your account at any time. Deleting your account removes your personal data and stops synchronization.
      </Text>

      <Text style={styles.heading}>
        International Users
      </Text>

      <Text style={styles.text}>
        This application is available worldwide. By using the app, you consent to the processing of your data as described in this policy.
      </Text>

      <Text style={styles.heading}>
        Changes
      </Text>

      <Text style={styles.text}>
        This privacy policy may be updated in future versions of the application.
      </Text>

      <Text style={styles.heading}>
        Last Updated
      </Text>

      <Text style={styles.text}>
        April 2026
      </Text>
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