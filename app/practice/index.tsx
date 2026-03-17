import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import PagerView from "react-native-pager-view";
import * as practiceService from "../../services/practiceService";
import PracticeContent from "./practiceContent";

export default function PracticePager() {

    const pagerRef = useRef<PagerView>(null);
    const { id } = useLocalSearchParams();

    const practices = practiceService.getAllPractices();
    const initialIndex = practices.findIndex(p => p.id === id);
    const [currentIndex, setCurrentIndex] = useState(initialIndex + 1);

    // circular trick
    const extended = [
        practices[practices.length - 1],
        ...practices,
        practices[0],
    ];


    return (
        <PagerView
            ref={pagerRef}
            style={{ flex: 1 }}
            initialPage={initialIndex + 1}
            onPageSelected={(e) => {
                const index = e.nativeEvent.position;
                setCurrentIndex(index);

                if (index === 0) {
                    pagerRef.current?.setPage(practices.length);
                }

                if (index === practices.length + 1) {
                    pagerRef.current?.setPage(1);
                }
            }}
        >
            {extended.map((p, i) => {

                const isActive = Math.abs(i - currentIndex) <= 1;

                return (
                    <View key={i} style={{ flex: 1 }}>
                        {isActive ? (
                            <PracticeContent practiceId={p.id} />
                        ) : (
                            <View />  // lightweight placeholder
                        )}
                    </View>
                );
            })}
        </PagerView>
    );
}