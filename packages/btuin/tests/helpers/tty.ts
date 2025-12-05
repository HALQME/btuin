import {
  enableTestMode,
  disableTestMode,
  getCapturedOutput,
  clearCapturedOutput,
} from "../../src/terminal/capture";

export function interceptTTY() {
  enableTestMode();

  return {
    restore() {
      disableTestMode();
    },
    output() {
      return getCapturedOutput();
    },
    clear() {
      clearCapturedOutput();
    },
  };
}
