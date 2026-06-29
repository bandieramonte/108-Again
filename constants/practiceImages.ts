export const practiceImages: Record<string, any> = {
    "short-refuge": require("../assets/practice-icons/short-refuge.png"),
    "prostrations": require("../assets/practice-icons/prostrations.png"),
    "diamond-mind": require("../assets/practice-icons/diamond-mind.png"),
    "mandala": require("../assets/practice-icons/mandala.png"),
    "guru-yoga": require("../assets/practice-icons/guru-yoga.png"),
    "amitabha": require("../assets/practice-icons/amitabha.png"),
    "generic": require("../assets/practice-icons/generic.png"),
    "green-tara": require("../assets/practice-icons/extra/green-tara.png"),
    "loving-eyes": require("../assets/practice-icons/extra/loving-eyes.png"),
    "white-liberatrice": require("../assets/practice-icons/extra/white- liberatrice.png"),
};

export const extraPracticeImageOptions = [
    {
        key: "green-tara",
        labelKey: "practiceImage.greenTara",
    },
    {
        key: "loving-eyes",
        labelKey: "practiceImage.lovingEyes",
    },
    {
        key: "white-liberatrice",
        labelKey: "practiceImage.whiteLiberatrice",
    },
] as const;
