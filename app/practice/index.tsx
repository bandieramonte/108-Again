import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import PagerView from "react-native-pager-view";
import * as practiceService from "../../services/practiceService";
import PracticeContent from "./practiceContent";

export default function PracticePager() {
    const pagerRef = useRef<PagerView>(null);
    const { id } = useLocalSearchParams();

    const practices = practiceService.getAllPractices();
    const pageCount = practices.length;
    const initialIndex = practices.findIndex(p => p.id === id);
    const initialPage = initialIndex + 1;
    const [loaded, setLoaded] = useState(
        new Set([initialPage])
    );
    const [currentIndex, setCurrentIndex] = useState(initialPage);

    const extended = useMemo(() => {
        if (pageCount === 0) return [];
        if (pageCount === 1) return [practices[0]];
        return [
            practices[pageCount - 1],
            ...practices,
            practices[0],
        ];
    }, [practices, pageCount]);

    const normalizedIndex = useMemo(() => {
        if (currentIndex === 0) return pageCount;
        if (currentIndex === pageCount + 1) return 1;
        return currentIndex;
    }, [currentIndex, pageCount]);

    const shouldRenderPage = (index: number) => {
        return Math.abs(index - normalizedIndex) <= 1;
    };
    const pendingJumpRef = useRef<number | null>(null);

    if (pageCount === 0) {
        return <View style={{ flex: 1 }} />;
    }

    if (pageCount === 1) {
        return (
            <View style={{ flex: 1 }}>
                <PracticeContent practiceId={practices[0].id} />
            </View>
        );
    }

    useEffect(() => {
        const id = setTimeout(() => {
            setLoaded(prev => {
                const next = new Set(prev);

                next.add(initialPage - 1);
                next.add(initialPage + 1);
                next.add(1);
                next.add(practices.length);

                return next;
            });
        }, 0);

        return () => clearTimeout(id);
    }, []);

    return (
        <PagerView
            ref={pagerRef}
            style={{ flex: 1 }}
            initialPage={initialPage}
            onPageScrollStateChanged={(e) => {
                if (e.nativeEvent.pageScrollState === "idle" && pendingJumpRef.current !== null) {
                    pagerRef.current?.setPageWithoutAnimation(pendingJumpRef.current);
                    setCurrentIndex(pendingJumpRef.current);
                    pendingJumpRef.current = null;
                }
            }}
            onPageSelected={(e) => {
                const index = e.nativeEvent.position;

                setLoaded(prev => {
                    const next = new Set(prev);
                    next.add(index);
                    next.add(index - 1);
                    next.add(index + 1);

                    if (index === 1) next.add(practices.length);
                    if (index === practices.length) next.add(1);

                    return next;
                });

                // 🚨 DO NOT jump immediately
                if (index === 0) {
                    pendingJumpRef.current = practices.length;
                    return;
                }

                if (index === practices.length + 1) {
                    pendingJumpRef.current = 1;
                    return;
                }

                setCurrentIndex(index);
            }}
        >
            {extended.map((p, i) => (
                <View key={`${p.id}-${i}`} style={{ flex: 1 }}>
                    {loaded.has(i) ? (
                        <PracticeContent practiceId={p.id} />
                    ) : (
                        <View style={{ flex: 1 }} />
                    )}
                </View>
            ))}
        </PagerView>
    );
}