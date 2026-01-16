import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

import { useAuth } from '@/context/AuthContext';

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
            sx={{
                width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
                ml: { xs: 0, sm: `${drawerWidth}px` },
                background: 'linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 20px rgba(13, 71, 161, 0.4)',
            }}
        >
            <Toolbar sx={{ minHeight: 64, gap: 1.5 }}>
                <IconButton
                    onClick={onMenuClick}
                    edge="start"
                    sx={{
                        display: { xs: 'inline-flex', sm: 'none' },
                        color: '#FFFFFF',
                    }}
                    aria-label="Otwórz nawigację"
                >
                    <MenuIcon />
                </IconButton>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        noWrap
                        component="div"
                        sx={{
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontSize: '1.1rem',
                        }}
                    >
                        {user.role === 'ADMIN' && 'Panel Administracyjny'}
                        {user.role === 'EMPLOYEE' && 'Panel Pracownika'}
                        {user.role === 'CLIENT' && 'Panel Klienta'}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '0.9rem',
                        }}
                        noWrap
                    >
                        Beauty Salon Management System
                    </Typography>
                </Box>

                <Chip
                    label={user.role_display}
                    size="small"
                    sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        backdropFilter: 'blur(10px)',
                        fontSize: '0.85rem',
                    }}
                />
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;