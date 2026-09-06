import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState
} from "react";
import { Animated, StyleSheet } from "react-native";
import { colors } from "../styles/theme";

export type FloatingAddAnimationRef = {
    trigger: (text: string) => void;
};

type FloatingEffect = {
    id: number;
    text: string;
    anim: Animated.Value;
    horizontalOffset: number;
};

const ANIMATION_DURATION_MS = 900;

const FloatingAddAnimation = forwardRef<
    FloatingAddAnimationRef
>((_, ref) => {

    const nextIdRef = useRef(0);
    const mountedRef = useRef(true);
    const [effects, setEffects] = useState<FloatingEffect[]>([]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useImperativeHandle(ref, () => ({
        trigger(text: string) {
            const id = nextIdRef.current++;
            const anim = new Animated.Value(0);

            setEffects(current => [
                ...current,
                {
                    id,
                    text,
                    anim,
                    horizontalOffset: ((id % 5) - 2) * 4
                }
            ]);

            requestAnimationFrame(() => {
                if (!mountedRef.current) return;

                Animated.timing(anim, {
                    toValue: 1,
                    duration: ANIMATION_DURATION_MS,
                    useNativeDriver: true
                }).start(() => {
                    if (!mountedRef.current) return;
                    setEffects(current =>
                        current.filter(effect => effect.id !== id)
                    );
                });
            });
        }
    }));

    return (
        <>
            {effects.map(effect => {
                const translateY = effect.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -25]
                });

                const translateX = effect.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                        effect.horizontalOffset,
                        effect.horizontalOffset + 10
                    ]
                });

                const opacity = effect.anim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [1, 1, 0]
                });

                return (
                    <Animated.Text
                        key={effect.id}
                        pointerEvents="none"
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
                        {effect.text}
                    </Animated.Text>
                );
            })}
        </>
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
