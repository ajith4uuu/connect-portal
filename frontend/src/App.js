import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import Survey from './components/Survey';
import ThankYou from './components/ThankYou';
import Header from './components/Header';
import Footer from './components/Footer';
import './App.css';

// BCC Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#e5317a', // BCC Pink
      light: '#f8d7e4', // BCC Light Pink
      dark: '#c02969'
    },
    secondary: {
      main: '#0e3b33', // BCC Green
      light: '#53868b', // BCC Light Green
      dark: '#092922'
    },
    background: {
      default: 'linear-gradient(135deg, #e5317a 0%, #f8d7e4 100%)'
    }
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      color: '#0e3b33'
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
      color: '#0e3b33'
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      color: '#0e3b33'
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '30px',
          padding: '0.8rem 1.8rem',
          fontSize: '1.05rem',
          fontWeight: 500,
          textTransform: 'none',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }
        },
        containedPrimary: {
          backgroundColor: '#53868b',
          color: '#fff',
          '&:hover': {
            backgroundColor: '#3d6c6d'
          }
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '5px',
            backgroundColor: '#f9f9f9',
            '&.Mui-focused fieldset': {
              borderColor: '#53868b',
              boxShadow: '0 0 0 2px rgba(83,134,139,0.3)'
            }
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          boxShadow: '0 6px 20px rgba(0,0,0,.3)'
        }
      }
    },
    MuiStepper: {
      styleOverrides: {
        root: {
          '& .MuiStepIcon-root.Mui-active': {
            color: '#53868b'
          },
          '& .MuiStepIcon-root.Mui-completed': {
            color: '#53868b'
          }
        }
      }
    }
  }
});

function App() {
  const [surveyData, setSurveyData] = useState(null);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <div className="App">
            <Header />
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
              <Routes>
                <Route
                  path="/"
                  element={<Survey onComplete={setSurveyData} />}
                />
                <Route
                  path="/thank-you"
                  element={<ThankYou data={surveyData} />}
                />
              </Routes>
            </Container>
            <ToastContainer 
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </div>
        </Router>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export default App;
