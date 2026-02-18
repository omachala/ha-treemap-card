/**
 * Test setup: polyfill browser APIs not supported by jsdom
 */

// jsdom does not implement PointerEvent; polyfill it with MouseEvent
if (typeof PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    public pointerType: string;
    public pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerType = params.pointerType ?? 'mouse';
      this.pointerId = params.pointerId ?? 1;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = PointerEvent;
}
