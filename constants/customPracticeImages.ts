export const CUSTOM_PRACTICE_IMAGE_KEY = "custom-upload";
export const CUSTOM_PRACTICE_IMAGE_WIDTH = 385;
export const CUSTOM_PRACTICE_IMAGE_HEIGHT = 430;
export const CUSTOM_PRACTICE_IMAGE_PIXELS =
    CUSTOM_PRACTICE_IMAGE_WIDTH * CUSTOM_PRACTICE_IMAGE_HEIGHT;

export function pendingPracticeImageRemovalKey(practiceId: string) {
    return `pendingPracticeImageRemoval:${practiceId}`;
}
