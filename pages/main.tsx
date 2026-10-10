import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Encourager } from "@/components/encourager";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing root");

createRoot(root).render(
  <StrictMode>
    <Encourager />
  </StrictMode>,
);
