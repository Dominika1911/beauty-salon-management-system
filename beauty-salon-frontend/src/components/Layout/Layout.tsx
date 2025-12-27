import React from "react";
import { Box, Toolbar, Container } from "@mui/material";
import { Outlet } from "react-router-dom";

import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import { useAuth } from "@/context/AuthContext";

const drawerWidth = 240;

const Layout: React.FC = () => {
  const { user } = useAuth();
  const hasSidebar = Boolean(user);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Navbar />
      <Sidebar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: hasSidebar ? `calc(100% - ${drawerWidth}px)` : "100%",
          p: { xs: 2, sm: 3 },
        }}
      >
        {hasSidebar ? <Toolbar /> : null}

        <Container maxWidth="xl" disableGutters sx={{ px: { xs: 0, sm: 0 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
