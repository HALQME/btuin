export interface KeyEvent {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  data?: string;
}

export type KeyHandler = (event: KeyEvent) => void;
