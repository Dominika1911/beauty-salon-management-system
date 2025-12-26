// src/components/Layout/Layout.tsx
import React from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet } from "react-router-dom";

import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import { useAuth } from "@/context/AuthContext";

const drawerWidth = 240;

const Layout: React.FC = () => {
  const { user } = useAuth();
  const hasSidebar = Boolean(user);

  return (
    <Box sx={{ display: "flex" }}>
      <Navbar />
      <Sidebar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          p: 3,
          width: hasSidebar ? `calc(100% - ${drawerWidth}px)` : "100%",
        }}
      >
        {hasSidebar ? <Toolbar /> : null}
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
