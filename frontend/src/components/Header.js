import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppBar, Toolbar, Typography, ToggleButtonGroup, ToggleButton,
  Box, Tooltip
} from '@mui/material';

function Header() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  const currentLang = (i18n.language || 'en').startsWith('fr') ? 'fr' : 'en';

  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#0e3b33' }}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 120 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img
            src="https://progressconnect.ca/wp-content/uploads/2023/10/BCC-PC-Light-Pink-Pantone-250.png"
            alt="BCC Logo"
            style={{ height: '70px', margin: '10px 0' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
            Progress CONNECT
          </Typography>
        </Box>

        <ToggleButtonGroup
          exclusive
          value={currentLang}
          onChange={(_, val) => val && i18n.changeLanguage(val)}
          size="small"
          aria-label="Language"
          sx={{
            backgroundColor: 'white',
            borderRadius: '24px',
            '& .MuiToggleButton-root': {
              color: '#0e3b33',
              border: '1px solid #e0e0e0',
              px: 1.5,
              '&.Mui-selected': {
                backgroundColor: '#f8d7e4',
                color: '#0e3b33',
                fontWeight: 700
              }
            }
          }}
        >
          <Tooltip title="English (Canada)">
            <ToggleButton value="en" aria-label="English (Canada)">EN (CA)</ToggleButton>
          </Tooltip>
          <Tooltip title="Français (Québec)">
            <ToggleButton value="fr" aria-label="Français (Québec)">FR (QC)</ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
