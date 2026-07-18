/** Single call site for destructive-action confirmation, so every view asks the same way. */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
