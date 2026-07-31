import "@fontsource-variable/manrope";
import React from "react";
import { createRoot } from "react-dom/client";
import ImageOptimizer from "./ImageOptimizer";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ImageOptimizer />
  </React.StrictMode>,
);
