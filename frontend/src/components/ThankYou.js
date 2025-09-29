import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Paper
} from '@mui/material';
import { Download, CheckCircle, Home } from '@mui/icons-material';

function ThankYou({ data }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // If no data, redirect to home
    if (!data) {
      navigate('/');
    }
  }, [data, navigate]);

  if (!data) {
    return null;
  }

  return (
    <Box sx={{ 
      minHeight: '80vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <Card sx={{ maxWidth: 700, width: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircle sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
          
          <Typography variant="h3" gutterBottom sx={{ color: '#0e3b33', fontWeight: 600 }}>
            {t('thank_you')}
          </Typography>
          
          <Typography variant="h6" sx={{ mb: 3, color: '#666' }}>
            {t('submission_received')}
          </Typography>
          
          <Paper elevation={1} sx={{ p: 3, mb: 3, bgcolor: '#f5f5f5', textAlign: 'left' }}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>{t('selected_stage')}:</strong> {data.userStage}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              <strong>{t('calculated_stage')}:</strong> {data.calculatedStage}
            </Typography>
            {data.packages && (
              <Typography variant="subtitle1" gutterBottom>
                <strong>{t('bcc_package')}:</strong> {data.packages}
              </Typography>
            )}
          </Paper>
          
          {data.geminiSummary && (
            <Paper elevation={2} sx={{ 
              p: 3, 
              mb: 3, 
              bgcolor: '#f5f5f5',
              textAlign: 'left',
              borderLeft: '4px solid #53868b'
            }}>
              <Typography variant="h6" sx={{ 
                color: '#53868b', 
                borderBottom: '2px solid #e5317a',
                pb: 1,
                mb: 2
              }}>
                {t('ai_summary')}
              </Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 2 }}>
                {t('summary_text')}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {data.geminiSummary}
              </Typography>
            </Paper>
          )}
          
          {data.downloadUrl && (
            <Button
              variant="contained"
              size="large"
              startIcon={<Download />}
              href={data.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                mb: 3,
                backgroundColor: '#53868b',
                borderRadius: '30px',
                py: 1.5,
                px: 4,
                '&:hover': {
                  backgroundColor: '#3d6c6d',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }
              }}
            >
              {t('download_btn')}
            </Button>
          )}
          
          <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
            {t('email_sent')}
          </Typography>
          
          <Button
            variant="outlined"
            startIcon={<Home />}
            onClick={() => navigate('/')}
            sx={{ borderRadius: '30px' }}
          >
            {t('start_new_survey')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ThankYou;
