import { createTheme, responsiveFontSizes } from "@mui/material";

// Definicja bazowego motywu
let theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#D81B60" },
    secondary: { main: "#AD1457" },
    background: {
      default: "#F7F7FB",
      paper: "#FCFCFE",
    },
    divider: "rgba(17, 24, 39, 0.12)",
    text: {
      primary: "#111827",
      secondary: "#6B7280",
    },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    info: { main: "#2563EB" },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F7F7FB",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderBottom: "1px solid rgba(17, 24, 39, 0.12)",
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid rgba(17, 24, 39, 0.12)",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
      variants: [
        {
          props: { variant: "outlined" },
          style: {
            borderColor: "rgba(17, 24, 39, 0.12)",
            backgroundColor: "#FFFFFF",
            transition: "box-shadow 120ms ease, border-color 120ms ease",
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "none",
          backgroundImage: "none",
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(17, 24, 39, 0.12)",
          transition: "box-shadow 120ms ease, border-color 120ms ease",
          "&:hover": {
            boxShadow: "0 1px 8px rgba(17, 24, 39, 0.06)",
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingLeft: 14,
          paddingRight: 14,
          minHeight: 40,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiAlert: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "rgba(17, 24, 39, 0.02)",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(17, 24, 39, 0.26)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderWidth: 2,
          },
        },
        notchedOutline: {
          borderColor: "rgba(17, 24, 39, 0.16)",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
        },
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
        stickyHeader: true,
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 800,
          color: "#111827",
          whiteSpace: "nowrap",
          backgroundColor: "rgba(17, 24, 39, 0.03)",
          borderBottomColor: "rgba(17, 24, 39, 0.12)",
        },
        body: {
          borderBottomColor: "rgba(17, 24, 39, 0.12)",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "rgba(17, 24, 39, 0.03)",
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 800,
          paddingBottom: 8,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: 12,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: 16,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
    },
  },
});

// Aplikujemy responsywne fonty i eksportujemy
export const appTheme = responsiveFontSizes(theme);