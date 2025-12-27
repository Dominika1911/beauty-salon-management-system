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
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import {
  Dashboard,
  Event,
  People,
  ContentCut,
  Person,
  Assessment,
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
  // =========================
  // WSPÓLNE
  // =========================
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

  // =========================
  // ADMIN
  // =========================
  { text: "Wizyty", icon: <Event />, path: "/admin/appointments", roles: ["ADMIN"] },
  { text: "Pracownicy", icon: <People />, path: "/admin/employees", roles: ["ADMIN"] },
  { text: "Grafiki", icon: <Schedule />, path: "/admin/employees-schedule", roles: ["ADMIN"] },
  { text: "Klienci", icon: <Person />, path: "/admin/clients", roles: ["ADMIN"] },
  { text: "Usługi", icon: <ContentCut />, path: "/admin/services", roles: ["ADMIN"] },
  { text: "Raporty", icon: <Assessment />, path: "/admin/reports", roles: ["ADMIN"] },
  { text: "Ustawienia", icon: <Settings />, path: "/admin/settings", roles: ["ADMIN"] },
  { text: "Logi", icon: <History />, path: "/admin/logs", roles: ["ADMIN"] },
  { text: "Urlopy", icon: <Event />, path: "/admin/time-offs", roles: ["ADMIN"] },

  // =========================
  // EMPLOYEE
  // =========================
  { text: "Terminarz", icon: <CalendarMonth />, path: "/employee/calendar", roles: ["EMPLOYEE"] },
  { text: "Moje wizyty", icon: <Event />, path: "/employee/appointments", roles: ["EMPLOYEE"] },
  { text: "Grafik", icon: <Schedule />, path: "/employee/schedule", roles: ["EMPLOYEE"] },
  { text: "Urlopy", icon: <Event />, path: "/employee/time-offs", roles: ["EMPLOYEE"] },

  // =========================
  // CLIENT
  // =========================
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

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
      navigate("/login", { replace: true });
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
        },
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <ContentCut color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Beauty Salon
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
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
          color="text.secondary"
          sx={{ px: 2, py: 0.5, letterSpacing: 0.8 }}
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
                  sx={{
                    px: 1.25,
                    py: 1,
                    "& .MuiListItemIcon-root": {
                      minWidth: 36,
                      color: selected ? "primary.main" : "text.secondary",
                    },
                    "& .MuiListItemText-primary": {
                      fontSize: 14,
                      fontWeight: selected ? 700 : 600,
                      lineHeight: 1.2,
                    },
                    "&.Mui-selected": {
                      bgcolor: "rgba(216, 27, 96, 0.08)", // różowy akcent pod theme
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
              sx={{ textTransform: "none" }}
            >
              Wyloguj
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Potwierdzenie */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Wylogować się?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zostaniesz wylogowany z systemu. Czy na pewno chcesz kontynuować?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: "none" }}>
            Anuluj
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleLogout()}
            sx={{ textTransform: "none" }}
          >
            Wyloguj
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default Sidebar;
