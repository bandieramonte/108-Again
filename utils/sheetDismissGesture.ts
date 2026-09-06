const MINIMUM_FAST_SWIPE_DISTANCE = 20;
const FAST_SWIPE_VELOCITY = 0.8;
const MAXIMUM_DRAG_DISTANCE = 120;
const DRAG_DISTANCE_RATIO = 0.15;

export function shouldDismissSheetFromDrag(
    translationY: number,
    velocityY: number,
    sheetHeight: number
): boolean {
    if (translationY <= 0) return false;

    const distanceThreshold = Math.min(
        MAXIMUM_DRAG_DISTANCE,
        sheetHeight * DRAG_DISTANCE_RATIO
    );

    return translationY >= distanceThreshold || (
        translationY >= MINIMUM_FAST_SWIPE_DISTANCE &&
        velocityY >= FAST_SWIPE_VELOCITY
    );
}
