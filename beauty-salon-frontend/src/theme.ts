import { createTheme, responsiveFontSizes } from '@mui/material';

let theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#D81B60' },
        secondary: { main: '#AD1457' },
        background: {
            default: '#FFF5F7',
            paper: '#FEFBFD',
        },
        divider: 'rgba(216, 27, 96, 0.12)',
        text: {
            primary: '#2D2D2D',
            secondary: '#5F6368',
        },
        success: { main: '#16A34A' },
        warning: { main: '#D97706' },
        error: { main: '#DC2626' },
        info: { main: '#2563EB' },
    },
    shape: {
        borderRadius: 12,
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h6: { fontWeight: 800 },
        subtitle1: { fontWeight: 700 },
        button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#FFF5F7', // Tło całej strony
                    color: '#2D2D2D',
                    scrollbarColor: '#D81B60 #FFF5F7',
                    '&::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#D81B60',
                        borderRadius: '10px',
                    },
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#FEFBFD',
                    color: '#D81B60',
                    boxShadow: 'none',
                    borderBottom: '1px solid rgba(216, 27, 96, 0.12)',
                    backgroundImage: 'none',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#FCE4EC',
                    borderRight: '1px solid rgba(216, 27, 96, 0.12)',
                    backgroundImage: 'none',
                },
            },
        },
        MuiPaper: {
            defaultProps: {
                elevation: 0,
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#FEFBFD',
                },
            },
            variants: [
                {
                    props: { variant: 'outlined' },
                    style: {
                        borderColor: 'rgba(216, 27, 96, 0.2)',
                        backgroundColor: '#FEFBFD',
                    },
                },
            ],
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: 'none',
                    backgroundColor: '#FFF9FA',
                    border: '1px solid rgba(216, 27, 96, 0.15)',
                    transition: 'box-shadow 120ms ease, border-color 120ms ease',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(216, 27, 96, 0.08)',
                        borderColor: '#D81B60',
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
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    margin: '4px 8px',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(216, 27, 96, 0.08)',
                        color: '#D81B60',
                        '& .MuiListItemIcon-root': {
                            color: '#D81B60',
                        },
                    },
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    backgroundColor: '#FEFBFD',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#D81B60',
                    },
                },
                notchedOutline: {
                    borderColor: 'rgba(216, 27, 96, 0.2)',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 800,
                    color: '#D81B60',
                    backgroundColor: '#FCE4EC',
                    borderBottom: '2px solid #D81B60',
                },
                body: {
                    color: '#2D2D2D',
                },
            },
        },
    },
});

export const appTheme = responsiveFontSizes(theme);
