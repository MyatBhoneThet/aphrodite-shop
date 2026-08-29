import type { DetailedHTMLProps, HTMLAttributes, CSSProperties } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        poster?: string;
        alt?: string;
        ar?: boolean | string;
        "camera-controls"?: boolean | string;
        "disable-zoom"?: boolean | string;
        "auto-rotate"?: boolean | string;
        "shadow-intensity"?: string;
        exposure?: string;
        "environment-image"?: string;
        "interaction-prompt"?: string;
        style?: CSSProperties;
      };
    }
  }
}

export {};
