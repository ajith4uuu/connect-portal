import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppBar, Toolbar, Typography, Select, MenuItem,
  FormControl, Box
} from '@mui/material';

function Header() {
  const { t, i18n } = useTranslation();

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
            style={{ height: '110px', margin: '20px 0' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
            Progress CONNECT
          </Typography>
        </Box>

        <FormControl variant="outlined" size="small">
          <Select
            value={currentLang}
            onChange={handleLanguageChange}
            sx={{
              backgroundColor: 'white',
              color: '#0e3b33',
              fontWeight: 500,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#ccc'
              }
            }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="fr">Français</MenuItem>
          </Select>
        </FormControl>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
