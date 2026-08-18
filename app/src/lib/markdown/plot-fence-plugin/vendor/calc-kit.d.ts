export type CalcKitSpec = {
  type?: string;
  title?: string;
  caption?: string;
  height?: string;
  [key: string]: unknown;
};

export type CalcKitFigureApi = {
  figure: HTMLElement;
  canvas: HTMLCanvasElement;
  controls: HTMLElement;
  readout: (text: string) => void;
  _teardownResize?: () => void;
};

export type CalcKitComponent = (
  fig: CalcKitFigureApi,
  spec: CalcKitSpec,
) => void;

export const components: Record<string, CalcKitComponent>;
export function compile(
  src: string | ((...args: number[]) => number),
  vars?: string[],
): (...args: number[]) => number;
export function makeFigureApi(el: HTMLElement): CalcKitFigureApi;
