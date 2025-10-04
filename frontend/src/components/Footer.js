import React from 'react';
import { Box, Container, Typography, IconButton, Stack, Link as MuiLink } from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

function Footer() {
  return (
    <Box component="footer" sx={{
      backgroundColor: '#0e3b33',
      color: '#fff',
      height: '1cm',
      display: 'flex',
      alignItems: 'center',
      width: '100%'
    }}>
      <Container maxWidth="md" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          © {new Date().getFullYear()} Breast Cancer Canada · Progress CONNECT
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            component={MuiLink}
            href="https://www.facebook.com/breastcancercanada/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            sx={{ color: '#fff' }}
          >
            <FacebookIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            component={MuiLink}
            href="https://twitter.com/BreastCancerCDN"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            sx={{ color: '#fff' }}
          >
            <TwitterIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            component={MuiLink}
            href="https://www.youtube.com/@BreastCancerCDN"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            sx={{ color: '#fff' }}
          >
            <YouTubeIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            component={MuiLink}
            href="https://www.linkedin.com/company/breastcancercanada/?viewAsMember=true"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            sx={{ color: '#fff' }}
          >
            <LinkedInIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;
