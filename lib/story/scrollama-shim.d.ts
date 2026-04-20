declare module "scrollama" {
  interface ScrollamaSetupOptions {
    step: string;
    offset?: number;
    progress?: boolean;
  }
  interface ScrollamaCallback {
    element: Element;
    index: number;
    progress: number;
  }
  interface ScrollamaInstance {
    setup(opts: ScrollamaSetupOptions): ScrollamaInstance;
    onStepEnter(cb: (res: ScrollamaCallback) => void): ScrollamaInstance;
    onStepExit(cb: (res: ScrollamaCallback) => void): ScrollamaInstance;
    onStepProgress(cb: (res: ScrollamaCallback) => void): ScrollamaInstance;
    resize(): void;
    destroy(): void;
  }
  function scrollama(): ScrollamaInstance;
  export default scrollama;
}
