import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { muiTheme } from "./theme";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      {/* Applies MUI's colour-scheme-aware background and text colours. */}
      <CssBaseline enableColorScheme />
      <App />
    </ThemeProvider>
  </StrictMode>
);
