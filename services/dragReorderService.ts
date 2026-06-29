import { startTransition } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    ScrollView,
    unstable_batchedUpdates,
    View,
    type GestureResponderHandlers,
} from "react-native";

export type DragReorderItem = {
    id: string;
};

export type DragCardLayout = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type DragOverlayFrame = {
    left: number;
    width: number;
};

export type DragReorderOptions = {
    autoScrollEdge: number;
    autoScrollSpeedPerSecond: number;
    autoScrollMaxFrameMs: number;
    releaseAnimationMs: number;
    pressSuppressMs: number;
};

export type DragReorderCallbacks<TItem extends DragReorderItem> = {
    getItems: () => TItem[];
    setItems: (items: TItem[]) => void;
    setPreviewOrderIds: (orderIds: string[] | null) => void;
    setDraggingItemId: (itemId: string | null) => void;
    setOverlayItem: (item: TItem | null) => void;
    setOverlayFrame: (frame: DragOverlayFrame | null) => void;
    onReorder?: (orderIds: string[]) => void;
    onReorderError?: (error: any) => void;
};

const DEFAULT_OPTIONS: DragReorderOptions = {
    autoScrollEdge: 96,
    autoScrollSpeedPerSecond: 360,
    autoScrollMaxFrameMs: 32,
    releaseAnimationMs: 120,
    pressSuppressMs: 120,
};

export const DEFAULT_DRAG_REORDER_ANIMATION_MS = 150;

export function sameDragOrder(left: string[], right: string[]) {
    if (left.length !== right.length) return false;

    return left.every((itemId, index) => itemId === right[index]);
}

export function reorderDragIds(
    orderedItemIds: string[],
    itemId: string,
    insertIndex: number
) {
    if (!orderedItemIds.includes(itemId)) {
        return orderedItemIds;
    }

    const withoutDragged =
        orderedItemIds.filter(id => id !== itemId);
    const clampedIndex =
        Math.max(0, Math.min(insertIndex, withoutDragged.length));
    const next = [...withoutDragged];

    next.splice(clampedIndex, 0, itemId);

    return next;
}

export function getDragPreviewItems<TItem extends DragReorderItem>(
    items: TItem[],
    previewOrderIds: string[] | null
) {
    if (!previewOrderIds) return items;

    const itemById = new Map(items.map(item => [item.id, item]));

    return previewOrderIds
        .map(itemId => itemById.get(itemId))
        .filter((item): item is TItem => Boolean(item));
}

export class DragReorderService<TItem extends DragReorderItem> {
    readonly scrollViewRef = { current: null as ScrollView | null };
    readonly rootRef = { current: null as View | null };
    readonly contentRef = { current: null as View | null };
    readonly cardRefs: Record<string, View | null> = {};
    readonly overlayTranslateY = new Animated.Value(0);

    private readonly callbacks: DragReorderCallbacks<TItem>;
    private readonly options: DragReorderOptions;
    private readonly cardLayouts: Record<string, DragCardLayout> = {};
    private readonly panHandlers: Record<string, GestureResponderHandlers> = {};
    private scrollY = 0;
    private scrollViewWindowX = 0;
    private scrollViewWindowY = 0;
    private scrollViewHeight = 0;
    private scrollContentHeight = 0;
    private contentX = 0;
    private rootWindowX = 0;
    private rootWindowY = 0;
    private contentWindowX = 0;
    private contentWindowY = 0;
    private startLayouts: Record<string, DragCardLayout> = {};
    private startLayout: DragCardLayout | null = null;
    private startOrder: string[] = [];
    private startItems: TItem[] = [];
    private currentOrder: string[] = [];
    private autoScrollFrame: number | null = null;
    private autoScrollLastTimestamp: number | null = null;
    private startScrollY = 0;
    private startOverlayTop: number | null = null;
    private latestDy = 0;
    private latestMoveY: number | null = null;
    private visualTopY: number | null = null;
    private draggingItemId: string | null = null;
    private moved = false;
    private suppressPress = false;

    constructor(
        callbacks: DragReorderCallbacks<TItem>,
        options?: Partial<DragReorderOptions>
    ) {
        this.callbacks = callbacks;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        };
    }

    dispose() {
        this.stopAutoScroll();
    }

    isPressSuppressed() {
        return this.suppressPress;
    }

    setScrollY(y: number) {
        if (this.draggingItemId) return;

        this.scrollY = y;
    }

    setScrollContentHeight(height: number) {
        this.scrollContentHeight = height;
    }

    handleScrollViewLayout(height: number) {
        this.scrollViewHeight = height;
        this.updateScrollViewWindowMetrics();
    }

    handleContentLayout(x: number) {
        this.contentX = x;
        this.updateContentWindowMetrics();
    }

    setCardLayout(itemId: string, layout: DragCardLayout) {
        this.cardLayouts[itemId] = layout;
    }

    updateRootWindowMetrics() {
        (this.rootRef.current as any)?.measureInWindow?.(
            (x: number, y: number) => {
                this.rootWindowX = x;
                this.rootWindowY = y;
            }
        );
    }

    getPanHandlers(itemId: string) {
        if (!this.panHandlers[itemId]) {
            this.panHandlers[itemId] =
                PanResponder.create({
                    onStartShouldSetPanResponder: () => true,
                    onStartShouldSetPanResponderCapture: () => true,
                    onMoveShouldSetPanResponder: () => true,
                    onMoveShouldSetPanResponderCapture: () => true,
                    onPanResponderGrant: () => this.beginDrag(itemId),
                    onPanResponderMove: (_, gestureState) =>
                        this.moveDrag(
                            itemId,
                            gestureState.dy,
                            gestureState.moveY
                        ),
                    onPanResponderRelease: () => this.finishDrag(),
                    onPanResponderTerminate: () => this.finishDrag(),
                    onPanResponderTerminationRequest: () => false,
                    onShouldBlockNativeResponder: () => true,
                }).panHandlers;
        }

        return this.panHandlers[itemId];
    }

    private buildItemsFromOrder(orderedItemIds: string[]) {
        const itemById =
            new Map(
                this.startItems.map(item => [
                    item.id,
                    item,
                ])
            );

        return orderedItemIds
            .map(itemId => itemById.get(itemId))
            .filter((item): item is TItem => Boolean(item));
    }

    private updateScrollViewWindowMetrics() {
        (this.scrollViewRef.current as any)?.measureInWindow?.(
            (x: number, y: number, _width: number, height: number) => {
                this.scrollViewWindowX = x;
                this.scrollViewWindowY = y;

                if (height > 0) {
                    this.scrollViewHeight = height;
                }
            }
        );
    }

    private updateContentWindowMetrics() {
        (this.contentRef.current as any)?.measureInWindow?.(
            (x: number, y: number) => {
                this.contentWindowX = x;
                this.contentWindowY = y;
            }
        );
    }

    private getOverlayLeftFromLayout(layout: DragCardLayout) {
        const contentWindowX =
            this.contentWindowX ||
            this.scrollViewWindowX +
            this.contentX;

        return contentWindowX -
            this.rootWindowX +
            layout.x;
    }

    private getOverlayTopFromLayout(layout: DragCardLayout) {
        if (this.contentWindowY) {
            return this.contentWindowY -
                this.rootWindowY +
                layout.y;
        }

        const scrollDelta =
            this.scrollY - this.startScrollY;

        if (this.startLayout && this.startOverlayTop != null) {
            return this.startOverlayTop +
                (layout.y - this.startLayout.y) -
                scrollDelta;
        }

        return this.scrollViewWindowY -
            this.rootWindowY +
            layout.y -
            this.scrollY;
    }

    private showOverlayFromMeasuredCard(
        itemId: string,
        draggedItem: TItem,
        fallbackLayout: DragCardLayout
    ) {
        const rootNode = this.rootRef.current as any;
        const cardNode = this.cardRefs[itemId] as any;

        if (
            !rootNode?.measureInWindow ||
            !cardNode?.measureInWindow
        ) {
            const fallbackTop = this.getOverlayTopFromLayout(fallbackLayout);

            this.startOverlayTop = fallbackTop;
            this.overlayTranslateY.setValue(fallbackTop + this.latestDy);
            this.callbacks.setOverlayItem(draggedItem);
            this.callbacks.setOverlayFrame({
                left: this.getOverlayLeftFromLayout(fallbackLayout),
                width: fallbackLayout.width,
            });
            this.callbacks.setDraggingItemId(itemId);
            return;
        }

        rootNode.measureInWindow((rootX: number, rootY: number) => {
            this.rootWindowX = rootX;
            this.rootWindowY = rootY;

            cardNode.measureInWindow(
                (
                    cardX: number,
                    cardY: number,
                    width: number
                ) => {
                    if (this.draggingItemId !== itemId) return;

                    const startOverlayTop = cardY - rootY;

                    this.startOverlayTop = startOverlayTop;
                    this.overlayTranslateY.setValue(
                        startOverlayTop + this.latestDy
                    );
                    this.callbacks.setOverlayItem(draggedItem);
                    this.callbacks.setOverlayFrame({
                        left: cardX - rootX,
                        width,
                    });
                    this.callbacks.setDraggingItemId(itemId);
                }
            );
        });
    }

    private getMaxScrollY() {
        return Math.max(
            0,
            this.scrollContentHeight - this.scrollViewHeight
        );
    }

    private getAutoScrollDirection(moveY: number) {
        const top = this.scrollViewWindowY;
        const height =
            this.scrollViewHeight ||
            Dimensions.get("window").height;
        const bottom = top + height;
        const topDistance = moveY - top;
        const bottomDistance = bottom - moveY;

        if (topDistance < this.options.autoScrollEdge) {
            return -1;
        }

        if (bottomDistance < this.options.autoScrollEdge) {
            return 1;
        }

        return 0;
    }

    private stopAutoScroll() {
        if (this.autoScrollFrame == null) return;

        cancelAnimationFrame(this.autoScrollFrame);
        this.autoScrollFrame = null;
        this.autoScrollLastTimestamp = null;
    }

    private runAutoScrollStep = (timestamp: number) => {
        const itemId = this.draggingItemId;
        const moveY = this.latestMoveY;

        if (!itemId || moveY == null) {
            this.autoScrollFrame = null;
            this.autoScrollLastTimestamp = null;
            return;
        }

        const direction = this.getAutoScrollDirection(moveY);

        if (direction === 0) {
            this.autoScrollFrame = null;
            this.autoScrollLastTimestamp = null;
            return;
        }

        const lastTimestamp =
            this.autoScrollLastTimestamp ?? timestamp;
        const elapsedMs = Math.min(
            this.options.autoScrollMaxFrameMs,
            Math.max(0, timestamp - lastTimestamp)
        );

        this.autoScrollLastTimestamp = timestamp;

        if (elapsedMs > 0) {
            const scrollDelta =
                direction *
                this.options.autoScrollSpeedPerSecond *
                (elapsedMs / 1000);
            const maxScrollY = this.getMaxScrollY();
            const nextScrollY = Math.round(
                Math.max(
                    0,
                    Math.min(maxScrollY, this.scrollY + scrollDelta)
                )
            );

            if (nextScrollY !== this.scrollY) {
                this.scrollY = nextScrollY;
                this.updateDragPosition(
                    itemId,
                    this.latestDy
                );
                this.scrollViewRef.current?.scrollTo({
                    y: nextScrollY,
                    animated: false,
                });
            }
        }

        if (this.draggingItemId) {
            this.autoScrollFrame = requestAnimationFrame(
                this.runAutoScrollStep
            );
        } else {
            this.autoScrollFrame = null;
            this.autoScrollLastTimestamp = null;
        }
    };

    private startAutoScroll() {
        if (this.autoScrollFrame != null) return;

        this.autoScrollLastTimestamp = null;
        this.autoScrollFrame = requestAnimationFrame(
            this.runAutoScrollStep
        );
    }

    private updateDraggedVisualPosition(itemId: string, dy: number) {
        if (this.draggingItemId !== itemId) return;

        if (!this.startLayout) return;

        if (this.startOverlayTop != null) {
            this.overlayTranslateY.setValue(this.startOverlayTop + dy);
        }

        const scrollDelta =
            this.scrollY - this.startScrollY;
        this.visualTopY =
            this.startLayout.y +
            dy +
            scrollDelta;
    }

    private beginDrag(itemId: string) {
        const layoutSnapshot = { ...this.cardLayouts };
        const startLayout = layoutSnapshot[itemId] ?? null;
        const items = this.callbacks.getItems();
        const draggedItem =
            items.find(item => item.id === itemId) ??
            null;

        if (!startLayout || !draggedItem) return;

        this.updateScrollViewWindowMetrics();
        this.updateRootWindowMetrics();
        this.updateContentWindowMetrics();
        this.overlayTranslateY.stopAnimation();
        this.draggingItemId = itemId;
        this.startLayouts = layoutSnapshot;
        this.startLayout = startLayout;
        this.startOrder =
            items.map(item => item.id);
        this.startItems = items;
        this.currentOrder = this.startOrder;
        this.callbacks.setPreviewOrderIds(this.startOrder);
        this.startScrollY = this.scrollY;
        this.startOverlayTop = null;
        this.latestDy = 0;
        this.latestMoveY = null;
        this.autoScrollLastTimestamp = null;
        this.moved = false;
        this.suppressPress = true;
        this.visualTopY = startLayout.y;
        this.showOverlayFromMeasuredCard(
            itemId,
            draggedItem,
            startLayout
        );
    }

    private updateDragPosition(itemId: string, dy: number) {
        if (this.draggingItemId !== itemId) return;

        if (!this.startLayout) return;

        this.updateDraggedVisualPosition(itemId, dy);

        const nextVisualTopY = this.visualTopY;
        if (nextVisualTopY == null) return;

        const draggedTopY = nextVisualTopY;
        let insertIndex = 0;

        for (const orderedItemId of this.startOrder) {
            if (orderedItemId === itemId) continue;

            const layout = this.startLayouts[orderedItemId];
            if (!layout) continue;

            if (draggedTopY > layout.y) {
                insertIndex += 1;
            }
        }

        const nextOrder =
            reorderDragIds(
                this.startOrder,
                itemId,
                insertIndex
            );

        if (sameDragOrder(this.currentOrder, nextOrder)) return;

        this.currentOrder = nextOrder;
        startTransition(() => {
            this.callbacks.setPreviewOrderIds(nextOrder);
        });
    }

    private moveDrag(
        itemId: string,
        dy: number,
        moveY: number
    ) {
        if (this.draggingItemId !== itemId) return;

        this.latestDy = dy;
        this.latestMoveY = moveY;

        if (Math.abs(dy) > 4) {
            this.moved = true;
        }

        this.updateDragPosition(itemId, dy);

        if (this.getAutoScrollDirection(moveY) === 0) {
            this.stopAutoScroll();
        } else {
            this.startAutoScroll();
        }
    }

    private finishDrag() {
        const draggedItemId = this.draggingItemId;
        const moved = this.moved;
        const startOrder = this.startOrder;
        const nextOrder =
            this.currentOrder.length > 0
                ? this.currentOrder
                : startOrder;
        const orderChanged =
            startOrder.length === nextOrder.length &&
            startOrder.some((itemId, index) => itemId !== nextOrder[index]);
        const targetSlotIndex =
            draggedItemId ? nextOrder.indexOf(draggedItemId) : -1;
        const targetSlotId =
            targetSlotIndex >= 0 ? startOrder[targetSlotIndex] : null;
        const targetSlotLayout =
            targetSlotId ? this.startLayouts[targetSlotId] : null;
        const finalItems =
            orderChanged ? this.buildItemsFromOrder(nextOrder) : [];
        const startLayout = this.startLayout;
        const startOverlayTop = this.startOverlayTop;
        const scrollDelta =
            this.scrollY - this.startScrollY;
        const releaseTop =
            targetSlotLayout && startLayout && startOverlayTop != null
                ? startOverlayTop +
                (targetSlotLayout.y - startLayout.y) -
                scrollDelta
                : targetSlotLayout
                    ? this.getOverlayTopFromLayout(targetSlotLayout)
                    : startOverlayTop ?? 0;

        this.draggingItemId = null;
        this.stopAutoScroll();
        this.startLayouts = {};
        this.startLayout = null;
        this.startOrder = [];
        this.startScrollY = 0;
        this.startOverlayTop = null;
        this.latestDy = 0;
        this.latestMoveY = null;
        this.moved = false;
        this.visualTopY = null;

        Animated.timing(this.overlayTranslateY, {
            toValue: releaseTop,
            duration: this.options.releaseAnimationMs,
            useNativeDriver: true,
        }).start(() => {
            unstable_batchedUpdates(() => {
                this.callbacks.setPreviewOrderIds(null);
                this.callbacks.setDraggingItemId(null);
                this.callbacks.setOverlayItem(null);
                this.callbacks.setOverlayFrame(null);

                if (orderChanged && finalItems.length === nextOrder.length) {
                    this.callbacks.setItems(finalItems);
                }

                this.startItems = [];
                this.currentOrder = [];
            });

            if (!draggedItemId || !moved || !orderChanged) return;

            try {
                this.callbacks.onReorder?.(nextOrder);
            } catch (error: any) {
                this.callbacks.onReorderError?.(error);
            }
        });

        setTimeout(() => {
            this.suppressPress = false;
        }, this.options.pressSuppressMs);
    }
}
