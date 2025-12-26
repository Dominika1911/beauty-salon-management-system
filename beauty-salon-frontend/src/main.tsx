// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

import { AuthProvider } from "./context/AuthContext";
import { router } from "./router/index";

const theme = createTheme({
  palette: {
    primary: { main: "#9c27b0" },
    secondary: { main: "#ff4081" },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
