"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";

const ModelViewer = "model-viewer" as ElementType;

type Props = {
  modelUrl?: string;
  imageUrl: string;
  productName: string;
  interactive?: boolean;
};

export default function Product3DViewer({
  modelUrl,
  imageUrl,
  productName,
  interactive = true,
}: Props) {
  const [isModelViewerReady, setIsModelViewerReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadModelViewer() {
      await import("@google/model-viewer");
      if (isMounted) {
        setIsModelViewerReady(true);
      }
    }

    loadModelViewer();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!modelUrl || !isModelViewerReady) {
    return (
      <img
        src={imageUrl}
        alt={productName}
        className="h-full w-full object-contain p-6"
      />
    );
  }

  return (
    <ModelViewer
      src={modelUrl}
      poster={imageUrl}
      alt={productName}
      camera-controls={interactive}
      auto-rotate
      shadow-intensity="1"
      exposure="1"
      environment-image="neutral"
      interaction-prompt={interactive ? "auto" : "none"}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: interactive ? "auto" : "none",
      }}
    />
  );
}