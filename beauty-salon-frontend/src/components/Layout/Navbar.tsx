import React from "react";
import { AppBar, Toolbar, Typography, Box, Chip, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "@/context/AuthContext";

const drawerWidth = 240;

type NavbarProps = {
  onMenuClick?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        width: { xs: "100%", sm: `calc(100% - ${drawerWidth}px)` },
        ml: { xs: 0, sm: `${drawerWidth}px` },
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.5 }}>
        {/* Hamburger tylko na mobile */}
        <IconButton
          onClick={onMenuClick}
          edge="start"
          sx={{ display: { xs: "inline-flex", sm: "none" } }}
          aria-label="Otwórz nawigację"
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap component="div" sx={{ fontWeight: 800 }}>
            {user.role === "ADMIN" && "Panel Administracyjny"}
            {user.role === "EMPLOYEE" && "Panel Pracownika"}
            {user.role === "CLIENT" && "Panel Klienta"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            Beauty Salon Management System
          </Typography>
        </Box>

        <Chip label={user.role_display} size="small" variant="outlined" />
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
