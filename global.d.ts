declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        poster?: string;
        "camera-controls"?: boolean;
        "disable-zoom"?: boolean;
        "auto-rotate"?: boolean;
        "shadow-intensity"?: string;
        exposure?: string;
        "environment-image"?: string;
        "interaction-prompt"?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

export {};
