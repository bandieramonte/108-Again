import { Animated, StyleSheet } from "react-native";

type Props = {
    fade: Animated.Value;
    sparkle1: Animated.Value;
    sparkle2: Animated.Value;
    sparkle3: Animated.Value;
};

export default function CelebrationOverlay({
    fade,
    sparkle1,
    sparkle2,
    sparkle3,
}: Props) {

    const sparkleStyle = (
        value: Animated.Value,
        translateX: number,
        translateY: number
    ) => ({
        opacity: value.interpolate({
            inputRange: [0, 0.2, 0.8, 1],
            outputRange: [0, 1, 1, 0],
        }),
        transform: [
            { translateX },
            {
                translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, translateY],
                }),
            },
            {
                scale: value.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.6, 1.1, 0.8],
                }),
            },
        ],
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { opacity: fade }]}
        >
            <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle1, 12, -18)]}>✦</Animated.Text>
            <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle2, 48, -34)]}>✦</Animated.Text>
            <Animated.Text style={[styles.sparkle, sparkleStyle(sparkle3, 84, -22)]}>✦</Animated.Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: -6,
        left: 0,
        right: 0,
        height: 24,
        pointerEvents: "none",
        zIndex: 20,
    },

    sparkle: {
        position: "absolute",
        fontSize: 16,
        color: "#a78bfa",
        fontWeight: "700",
    },
});