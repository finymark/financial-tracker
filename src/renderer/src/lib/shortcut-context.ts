export function shortcutTargetContext(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  return {
    editingText: Boolean(
      element?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ),
    ),
    multiline: Boolean(
      element?.closest(
        'textarea, [contenteditable]:not([contenteditable="false"])',
      ),
    ),
    activatingControl: Boolean(
      element?.closest('button, a[href], [role="button"]'),
    ),
  }
}
