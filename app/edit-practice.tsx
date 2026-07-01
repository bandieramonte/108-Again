import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useI18n } from "../i18n";
import * as practiceService from "../services/practiceService";
import { globalStyles } from "../styles/global";
import {
    digitsOnly,
    formatNumberInput,
    MAX_PRACTICE_NAME,
    MAX_REPETITIONS_PER_DAY,
    MAX_TARGET_COUNT,
    parseFormattedNumberInput,
    validateNonNegativeInteger,
    validateRepetitionCount,
    validateTargetCount,
} from "../utils/numberUtils";

export default function EditPractice() {

    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { locale, t } = useI18n();

    const [name, setName] = useState("");
    const [target, setTarget] = useState("");
    const [total, setTotal] = useState("");
    const [dailyTarget, setDailyTarget] = useState("");
    const [defaultSession, setDefaultSession] = useState("");

    useEffect(() => {
        const data = practiceService.getPracticeEditData(id as string);
        setName(data.name);
        setTarget(formatNumberInput(String(data.targetCount), locale));
        setTotal(formatNumberInput(String(data.total), locale));
        setDailyTarget(
            data.dailyTargetCount == null
                ? ""
                : formatNumberInput(String(data.dailyTargetCount), locale)
        );
        setDefaultSession(
            formatNumberInput(String(data.defaultSessionCount ?? 108), locale)
        );
    }, [id, locale]);

    function save() {

        if (!name.trim()) {
            alert(t("form.practiceNameRequired"));
            return;
        }

        const targetError =
            validateTargetCount(target);

        if (targetError) {
            alert(targetError);
            return;
        }

        const totalError =
            validateNonNegativeInteger(total, t("form.totalCount"));

        if (totalError) {
            alert(totalError);
            return;
        }

        const dailyTargetError =
            dailyTarget.trim()
                ? validateRepetitionCount(
                    dailyTarget,
                    t("dashboard.dailyTarget")
                )
                : null;

        if (dailyTargetError) {
            alert(dailyTargetError);
            return;
        }

        if (
            dailyTarget.trim() &&
            parseFormattedNumberInput(dailyTarget) <= 0
        ) {
            alert(t("dashboard.dailyTargetPositive"));
            return;
        }

        const defaultSessionError =
            validateRepetitionCount(
                defaultSession,
                t("form.defaultSessionCount")
            );

        if (defaultSessionError) {
            alert(defaultSessionError);
            return;
        }

        try {
            practiceService.updatePractice(
                id as string,
                name,
                parseFormattedNumberInput(target),
                parseFormattedNumberInput(total)
            );
            practiceService.updatePracticeDailyTargetCount(
                id as string,
                dailyTarget.trim()
                    ? parseFormattedNumberInput(dailyTarget)
                    : null
            );
            practiceService.updatePracticeDefaultSessionCount(
                id as string,
                parseFormattedNumberInput(defaultSession)
            );
        } catch (error: any) {
            alert(error.message);
            return;
        }

        router.back();
    }

    return (

        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={[
                    globalStyles.sidePadding,
                    globalStyles.formScreen,
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={globalStyles.formTitle}>
                    {t("form.editPracticeTitle")}
                </Text>

                <View style={globalStyles.formSectionCard}>
                    <Text style={globalStyles.formInputLabel}>
                        {t("form.name")}
                    </Text>
                    <TextInput
                        value={name}
                        onChangeText={(text) => setName(text.slice(0, MAX_PRACTICE_NAME))}
                        maxLength={25}
                        style={globalStyles.formInput}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.targetCount")}
                    </Text>
                    <TextInput
                        value={target}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_TARGET_COUNT) return;
                            setTarget(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        style={globalStyles.formInput}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.totalCountSoFar")}
                    </Text>
                    <TextInput
                        value={total}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_TARGET_COUNT) return;
                            setTotal(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        style={globalStyles.formInput}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.dailyTargetOptional")}
                    </Text>
                    <TextInput
                        value={dailyTarget}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setDailyTarget(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        placeholder={t("form.disabled")}
                        placeholderTextColor="#999"
                        style={globalStyles.formInput}
                    />

                    <Text style={globalStyles.formInputLabel}>
                        {t("form.defaultSessionCount")}
                    </Text>
                    <TextInput
                        value={defaultSession}
                        onChangeText={(v) => {
                            const clean = digitsOnly(v);
                            if (Number(clean) > MAX_REPETITIONS_PER_DAY) return;
                            setDefaultSession(formatNumberInput(clean, locale));
                        }}
                        keyboardType="numeric"
                        style={globalStyles.formInput}
                    />

                </View>

                <Pressable
                    style={globalStyles.formSaveButton}
                    onPress={save}
                >
                    <Text style={globalStyles.formSaveButtonText}>
                        {t("common.save")}
                    </Text>
                </Pressable>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}
