import {
    forwardRef,
    useImperativeHandle,
    useRef
} from "react";
import { Animated, StyleSheet } from "react-native";
import { colors } from "../styles/theme";

export type FloatingAddAnimationRef = {
    trigger: (text: string) => void;
};

const FloatingAddAnimation = forwardRef<
    FloatingAddAnimationRef
>((_, ref) => {

    const anim = useRef(new Animated.Value(0)).current;
    const textRef = useRef("");

    useImperativeHandle(ref, () => ({
        trigger(text: string) {
            textRef.current = text;

            anim.setValue(0);

            Animated.timing(anim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true
            }).start();
        }
    }));

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -25]
    });

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 10]
    });

    const opacity = anim.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [0, 1, 0]
    });

    return (
        <Animated.Text
            style={[
                styles.text,
                {
                    opacity,
                    transform: [
                        { translateY },
                        { translateX }
                    ]
                }
            ]}
        >
            {textRef.current}
        </Animated.Text>
    );
});

FloatingAddAnimation.displayName = "FloatingAddAnimation";

export default FloatingAddAnimation;

const styles = StyleSheet.create({
    text: {
        position: "absolute",
        left: "80%",
        top: 0,
        zIndex: 50,
        elevation: 50,
        fontSize: 14,
        fontWeight: "600",
        color: colors.primary
    }
});
