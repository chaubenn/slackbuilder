export const COPY_BUTTON_FULL_WIDTH = 132;
export const COPY_BUTTON_COLLAPSE_BUFFER = 16;

export function shouldCompactCopyButton(
  toolbarWidth: number,
  toolsWidth: number,
): boolean {
  const requiredWidth =
    toolsWidth + COPY_BUTTON_FULL_WIDTH + COPY_BUTTON_COLLAPSE_BUFFER;
  return toolbarWidth < requiredWidth;
}
