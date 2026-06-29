import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

type ReachedCelebrationItem = {
    id: string;
    total: number;
    targetCount: number;
};

function storageKey(id: string) {
    return `highestCelebratedTarget:${id}`;
}

export function useReachedCelebration() {
    const previousTotalRef = useRef<Record<string, number>>({});
    const highestCelebratedTargetRef = useRef<Record<string, number>>({});
    const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sparkleAnimationsRef = useRef<Animated.CompositeAnimation[]>([]);
    const [celebratingId, setCelebratingId] = useState<string | null>(null);

    const celebrationFade = useRef(new Animated.Value(1)).current;
    const sparkle1 = useRef(new Animated.Value(0)).current;
    const sparkle2 = useRef(new Animated.Value(0)).current;
    const sparkle3 = useRef(new Animated.Value(0)).current;

    const stopAnimations = useCallback(() => {
        sparkleAnimationsRef.current.forEach(animation => animation.stop());
        sparkleAnimationsRef.current = [];
    }, []);

    const resetAnimatedValues = useCallback(() => {
        celebrationFade.setValue(1);
        sparkle1.setValue(0);
        sparkle2.setValue(0);
        sparkle3.setValue(0);
    }, [
        celebrationFade,
        sparkle1,
        sparkle2,
        sparkle3,
    ]);

    const startCelebration = useCallback((id: string) => {
        if (celebrationTimeoutRef.current) {
            clearTimeout(celebrationTimeoutRef.current);
        }

        stopAnimations();

        setCelebratingId(id);
        resetAnimatedValues();

        const makeSparkle = (value: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(value, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: 0,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ])
            );

        const a1 = makeSparkle(sparkle1, 0);
        const a2 = makeSparkle(sparkle2, 180);
        const a3 = makeSparkle(sparkle3, 360);

        sparkleAnimationsRef.current = [a1, a2, a3];

        a1.start();
        a2.start();
        a3.start();

        celebrationTimeoutRef.current = setTimeout(() => {
            Animated.timing(celebrationFade, {
                toValue: 0,
                duration: 2000,
                useNativeDriver: true,
            }).start(() => {
                stopAnimations();
                setCelebratingId(null);

                setTimeout(() => {
                    resetAnimatedValues();
                }, 0);
            });
        }, 3000);
    }, [
        celebrationFade,
        resetAnimatedValues,
        sparkle1,
        sparkle2,
        sparkle3,
        stopAnimations,
    ]);

    const updateReachedState = useCallback(async (items: ReachedCelebrationItem[]) => {
        for (const item of items) {
            let highestCelebratedTarget = highestCelebratedTargetRef.current[item.id];
            if (highestCelebratedTarget === undefined) {
                const storedValue = await AsyncStorage.getItem(storageKey(item.id));
                highestCelebratedTarget = storedValue ? Number(storedValue) : 0;
                highestCelebratedTargetRef.current[item.id] = highestCelebratedTarget;
            }

            const previousTotal = previousTotalRef.current[item.id] ?? item.total;
            const crossedTarget =
                previousTotal < item.targetCount &&
                item.total >= item.targetCount;

            const shouldCelebrate =
                item.targetCount > 0 &&
                crossedTarget &&
                item.targetCount > highestCelebratedTarget;

            if (shouldCelebrate) {
                highestCelebratedTargetRef.current[item.id] = item.targetCount;
                await AsyncStorage.setItem(storageKey(item.id), String(item.targetCount));
                startCelebration(item.id);
            }

            previousTotalRef.current[item.id] = item.total;
        }
    }, [startCelebration]);

    const isCelebrating = useCallback((id: string) => {
        return celebratingId === id;
    }, [celebratingId]);

    useEffect(() => {
        return () => {
            if (celebrationTimeoutRef.current) {
                clearTimeout(celebrationTimeoutRef.current);
            }

            stopAnimations();
        };
    }, [stopAnimations]);

    return {
        celebrationFade,
        sparkle1,
        sparkle2,
        sparkle3,
        updateReachedState,
        isCelebrating,
    };
}
