import React from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";

import { useAuth } from "@/context/AuthContext";

const drawerWidth = 240;

const Navbar: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <AppBar
      position="fixed"
      sx={{
        width: `calc(100% - ${drawerWidth}px)`,
        ml: `${drawerWidth}px`,
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {user.role === "ADMIN" && "Panel Administracyjny"}
          {user.role === "EMPLOYEE" && "Panel Pracownika"}
          {user.role === "CLIENT" && "Panel Klienta"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
