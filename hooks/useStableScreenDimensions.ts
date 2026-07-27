import { useEffect, useState } from "react";
import { Dimensions, type ScaledSize } from "react-native";

function dimensionsMatch(first: ScaledSize, second: ScaledSize) {
    return (
        first.width === second.width &&
        first.height === second.height &&
        first.scale === second.scale &&
        first.fontScale === second.fontScale
    );
}

export function useStableScreenDimensions() {
    const [screen, setScreen] = useState(
        () => Dimensions.get("screen")
    );

    useEffect(() => {
        const subscription = Dimensions.addEventListener(
            "change",
            ({ screen: nextScreen }) => {
                setScreen(currentScreen =>
                    dimensionsMatch(currentScreen, nextScreen)
                        ? currentScreen
                        : nextScreen
                );
            }
        );

        return () => subscription.remove();
    }, []);

    return screen;
}
