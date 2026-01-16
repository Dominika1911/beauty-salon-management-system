import { createTheme, responsiveFontSizes } from '@mui/material';

let theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#0D47A1',      // Głęboki niebieski - lepszy kontrast
            light: '#1976D2',
            dark: '#01579B',
        },
        secondary: {
            main: '#6A1B9A',      // Głęboki fioletowy
            light: '#7B1FA2',
            dark: '#4A148C',
        },
        background: {
            default: '#FFFFFF',   // Czysty biały (najlepszy kontrast!)
            paper: '#FFFFFF',
        },
        text: {
            primary: '#000000',   // CZARNY - maksymalny kontrast 21:1!
            secondary: '#424242', // Ciemnoszary - kontrast 12.6:1
        },
        success: {
            main: '#1B5E20',      // Ciemnozielony
            light: '#2E7D32',
            dark: '#0D5016',
        },
        warning: {
            main: '#E65100',      // Ciemnopomarańczowy
            light: '#F57C00',
            dark: '#BF360C',
        },
        error: {
            main: '#B71C1C',      // Ciemnoczerwony
            light: '#C62828',
            dark: '#8B0000',
        },
        info: {
            main: '#01579B',      // Ciemnoniebieski
            light: '#0277BD',
            dark: '#004C8C',
        },
    },
    shape: {
        borderRadius: 8,
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Arial", sans-serif',
        fontSize: 15,  // Większa czcionka!
        h1: { fontWeight: 700, fontSize: '2.5rem', color: '#000000' },
        h2: { fontWeight: 700, fontSize: '2rem', color: '#000000' },
        h3: { fontWeight: 600, fontSize: '1.75rem', color: '#000000' },
        h4: { fontWeight: 600, fontSize: '1.5rem', color: '#000000' },
        h5: { fontWeight: 600, fontSize: '1.25rem', color: '#000000' },
        h6: { fontWeight: 600, fontSize: '1.1rem', color: '#000000' },
        subtitle1: { fontWeight: 600, fontSize: '1rem', color: '#000000' },
        subtitle2: { fontWeight: 500, fontSize: '0.95rem', color: '#424242' },
        body1: { fontSize: '1rem', lineHeight: 1.7, color: '#000000' },
        body2: { fontSize: '0.95rem', lineHeight: 1.6, color: '#424242' },
        button: {
            textTransform: 'none',
            fontWeight: 700,  // Bold przyciski
            fontSize: '1rem',
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background: 'linear-gradient(180deg, #E3F2FD 0%, #FFFFFF 20%, #FFFFFF 100%)',
                    minHeight: '100vh',
                    color: '#000000',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: 'linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 20px rgba(13, 71, 161, 0.4)',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#F5F5F5',  // Jasnoszary
                    borderRight: '2px solid #E0E0E0',  // Grubszy border
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #E0E0E0',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #E0E0E0',
                    backgroundColor: '#FFFFFF',
                    transition: 'all 250ms ease',
                    '&:hover': {
                        boxShadow: '0 8px 24px rgba(13, 71, 161, 0.2)',
                        transform: 'translateY(-4px)',
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontSize: '1rem',
                    fontWeight: 700,
                },
                contained: {
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                },
                containedPrimary: {
                    backgroundColor: '#0D47A1',
                    color: '#FFFFFF',
                    '&:hover': {
                        backgroundColor: '#01579B',
                    },
                },
                outlined: {
                    borderWidth: '2px',  // Grubszy border
                    '&:hover': {
                        borderWidth: '2px',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,  // Bold
                    fontSize: '0.9rem',
                    height: 32,
                },
                colorSuccess: {
                    backgroundColor: '#C8E6C9',  // Jasne tło
                    color: '#1B5E20',            // Ciemny tekst
                    border: '2px solid #2E7D32', // Wyraźny border
                },
                colorError: {
                    backgroundColor: '#FFCDD2',
                    color: '#B71C1C',
                    border: '2px solid #C62828',
                },
                colorWarning: {
                    backgroundColor: '#FFE0B2',
                    color: '#E65100',
                    border: '2px solid #F57C00',
                },
                colorInfo: {
                    backgroundColor: '#BBDEFB',
                    color: '#01579B',
                    border: '2px solid #0277BD',
                },
                colorPrimary: {
                    backgroundColor: '#BBDEFB',
                    color: '#01579B',
                    border: '2px solid #0277BD',
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    fontSize: '1rem',
                    fontWeight: 600,
                },
                standardSuccess: {
                    backgroundColor: '#C8E6C9',
                    color: '#1B5E20',
                    border: '2px solid #2E7D32',
                },
                standardError: {
                    backgroundColor: '#FFCDD2',
                    color: '#B71C1C',
                    border: '2px solid #C62828',
                },
                standardWarning: {
                    backgroundColor: '#FFE0B2',
                    color: '#E65100',
                    border: '2px solid #F57C00',
                },
                standardInfo: {
                    backgroundColor: '#BBDEFB',
                    color: '#01579B',
                    border: '2px solid #0277BD',
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    border: '2px solid #E0E0E0',  // Grubszy border
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    background: 'linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 700,      // Bold
                    color: '#FFFFFF',
                    backgroundColor: 'transparent',
                    fontSize: '1rem',     // Większa czcionka
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '16px',
                    borderBottom: '2px solid #01579B',
                },
                body: {
                    color: '#000000',     // Czarny tekst!
                    fontSize: '0.95rem',
                    padding: '14px 16px',
                    borderBottom: '1px solid #E0E0E0',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:nth-of-type(even)': {
                        backgroundColor: '#FAFAFA',  // Zebrowe tło dla lepszej czytelności
                    },
                    '&:hover': {
                        backgroundColor: '#F0F0F0 !important',
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '4px 8px',
                    '&.Mui-selected': {
                        backgroundColor: '#E3F2FD',  // Jasnoniebieski
                        color: '#01579B',            // Ciemnoniebieski
                        fontWeight: 700,
                        borderLeft: '4px solid #0D47A1',  // Grubszy border
                        '& .MuiListItemIcon-root': {
                            color: '#01579B',
                        },
                    },
                    '&:hover': {
                        backgroundColor: '#F5F5F5',
                    },
                },
            },
        },
        MuiListItemText: {
            styleOverrides: {
                primary: {
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: '#000000',
                },
                secondary: {
                    fontSize: '0.9rem',
                    color: '#424242',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    fontSize: '1rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',  // Grubszy border
                        borderColor: '#BDBDBD',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0D47A1',
                        borderWidth: '2px',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#0D47A1',
                        borderWidth: '3px',  // Jeszcze grubszy przy focus
                    },
                },
                input: {
                    color: '#000000',
                    fontSize: '1rem',
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '1rem',
                    color: '#424242',
                    fontWeight: 500,
                    '&.Mui-focused': {
                        color: '#0D47A1',
                        fontWeight: 600,
                    },
                },
            },
        },
        MuiTypography: {
            styleOverrides: {
                root: {
                    color: 'inherit',
                },
            },
        },
    },
});

export const appTheme = responsiveFontSizes(theme);