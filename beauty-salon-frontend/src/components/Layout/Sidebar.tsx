import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Card,
  CardContent,
  useMediaQuery,
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import {
  Dashboard,
  Event,
  People,
  ContentCut,
  Person,
  Assessment,
  BarChart, // ✅ DODANE - ikona dla Statystyki
  Settings,
  CalendarMonth,
  Schedule,
  ExitToApp,
  History,
} from "@mui/icons-material";

import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

const drawerWidth = 240;

interface MenuItemDef {
  text: string;
  icon: React.ReactElement;
  path: string;
  roles: UserRole[];
}

const menuItems: MenuItemDef[] = [
  // WSPÓLNE
  {
    text: "Dashboard",
    icon: <Dashboard />,
    path: "/dashboard",
    roles: ["ADMIN", "EMPLOYEE", "CLIENT"],
  },
  {
    text: "Moje konto",
    icon: <Person />,
    path: "/account",
    roles: ["ADMIN", "EMPLOYEE", "CLIENT"],
  },

  // ADMIN
  { text: "Wizyty", icon: <Event />, path: "/admin/appointments", roles: ["ADMIN"] },
  { text: "Pracownicy", icon: <People />, path: "/admin/employees", roles: ["ADMIN"] },
  { text: "Grafiki", icon: <Schedule />, path: "/admin/employees-schedule", roles: ["ADMIN"] },
  { text: "Klienci", icon: <Person />, path: "/admin/clients", roles: ["ADMIN"] },
  { text: "Usługi", icon: <ContentCut />, path: "/admin/services", roles: ["ADMIN"] },

  // ✅ DODANE - STATYSTYKI
  { text: "Statystyki", icon: <BarChart />, path: "/admin/statistics", roles: ["ADMIN"] },

  { text: "Raporty", icon: <Assessment />, path: "/admin/reports", roles: ["ADMIN"] },
  { text: "Ustawienia", icon: <Settings />, path: "/admin/settings", roles: ["ADMIN"] },
  { text: "Logi", icon: <History />, path: "/admin/logs", roles: ["ADMIN"] },
  { text: "Urlopy", icon: <Event />, path: "/admin/time-offs", roles: ["ADMIN"] },

  // EMPLOYEE
  { text: "Terminarz", icon: <CalendarMonth />, path: "/employee/calendar", roles: ["EMPLOYEE"] },
  { text: "Moje wizyty", icon: <Event />, path: "/employee/appointments", roles: ["EMPLOYEE"] },
  { text: "Grafik", icon: <Schedule />, path: "/employee/schedule", roles: ["EMPLOYEE"] },
  { text: "Urlopy", icon: <Event />, path: "/employee/time-offs", roles: ["EMPLOYEE"] },

  // CLIENT
  { text: "Rezerwacja", icon: <CalendarMonth />, path: "/client/booking", roles: ["CLIENT"] },
  { text: "Moje wizyty", icon: <Event />, path: "/client/appointments", roles: ["CLIENT"] },
];

function getRoleChipColor(role: UserRole): ChipProps["color"] {
  switch (role) {
    case "ADMIN":
      return "error";
    case "EMPLOYEE":
      return "primary";
    case "CLIENT":
      return "success";
    default:
      return "default";
  }
}

function isPathActive(currentPath: string, itemPath: string) {
  if (currentPath === itemPath) return true;
  return itemPath !== "/" && currentPath.startsWith(itemPath + "/");
}

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [confirmOpen, setConfirmOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!user) return [];
    return menuItems.filter((item) => item.roles.includes(user.role));
  }, [user]);

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setConfirmOpen(false);
      if (isMobile) onMobileClose();
      navigate("/login", { replace: true });
    }
  };

  const handleNavClick = () => {
    if (isMobile) onMobileClose();
  };

  const drawerContent = (
    <>
      {/* Header */}
      <Toolbar
        sx={{
          minHeight: 64,
          px: 2,
          bgcolor: "rgba(17, 24, 39, 0.02)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <ContentCut color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Beauty Salon
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
              Management System
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider />

      {/* Menu */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            px: 2,
            py: 0.5,
            letterSpacing: 0.8,
          }}
        >
          Nawigacja
        </Typography>

        <List sx={{ display: "flex", flexDirection: "column", gap: 0.5, px: 1 }}>
          {filteredItems.map((item) => {
            const selected = isPathActive(location.pathname, item.path);

            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={selected}
                  onClick={handleNavClick}
                  sx={{
                    px: 1.25,
                    py: 1,
                    border: "1px solid transparent",
                    "& .MuiListItemIcon-root": {
                      minWidth: 36,
                      color: selected ? "primary.main" : "text.secondary",
                    },
                    "& .MuiListItemText-primary": {
                      fontSize: 14,
                      fontWeight: selected ? 700 : 600,
                      lineHeight: 1.2,
                    },

                    // selected styling (bez hard-coded rgba różu)
                    "&.Mui-selected": {
                      bgcolor: "rgba(216, 27, 96, 0.08)",
                      borderColor: "rgba(216, 27, 96, 0.18)",
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: "rgba(216, 27, 96, 0.12)",
                    },

                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* Dolny pasek */}
      <Box sx={{ p: 2 }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 800 }} noWrap>
              {user.first_name} {user.last_name}
            </Typography>

            <Chip
              label={user.role_display}
              size="small"
              color={getRoleChipColor(user.role)}
              variant="outlined"
              sx={{ mb: 1 }}
            />

            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<ExitToApp fontSize="small" />}
              onClick={() => setConfirmOpen(true)}
            >
              Wyloguj
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Potwierdzenie */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ variant: "outlined" }}>
        <DialogTitle>Wylogować się?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zostaniesz wylogowany z systemu. Czy na pewno chcesz kontynuować?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Anuluj</Button>
          <Button color="error" variant="contained" onClick={() => void handleLogout()}>
            Wyloguj
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  const drawerSx = {
    width: drawerWidth,
    flexShrink: 0,
    "& .MuiDrawer-paper": {
      width: drawerWidth,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",

      // mniej "biało" i lepsza separacja od contentu
      bgcolor: "background.default",
      borderRight: "1px solid rgba(17, 24, 39, 0.12)",
    },
  } as const;

  return (
    <>
      {/* Mobile: temporary */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ ...drawerSx, display: { xs: "block", sm: "none" } }}
      >
        {/* wewnątrz dajemy biały "surface" na content */}
        <Box sx={{ height: "100%", bgcolor: "background.paper" }}>{drawerContent}</Box>
      </Drawer>

      {/* Desktop: permanent */}
      <Drawer variant="permanent" sx={{ ...drawerSx, display: { xs: "none", sm: "block" } }} open>
        <Box sx={{ height: "100%", bgcolor: "background.paper" }}>{drawerContent}</Box>
      </Drawer>
    </>
  );
};

export default Sidebar;