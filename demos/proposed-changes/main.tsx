import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyBrandTheme } from "../../src/web/lib/brand";
import "../../src/web/styles/tokens.css";
import "../../src/web/styles/global.css";
import "../../src/web/pages/Landing/landing.css";
import "./preview.css";
import { ProposalDemo } from "./ProposalDemo";
applyBrandTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProposalDemo />
  </StrictMode>,
);
