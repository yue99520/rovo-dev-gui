const IGNORE_ICONS = ['⣟', '⣯', '⣷', '⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷', '⣾', '⣽', '⣻', '⢿', '⡿'];

export function isOutputLoading(output: string): boolean {
  for (let ignoreIcon of IGNORE_ICONS) {
    if (output.includes(ignoreIcon)) {
      return false;
    }
  }
  return true;
}