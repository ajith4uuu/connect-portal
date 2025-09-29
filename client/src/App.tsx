import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from './i18n';
import SurveyWizard from './components/SurveyWizard';
import ThankYouPage from './components/ThankYouPage';
import LanguageSwitcher from './components/LanguageSwitcher';
import './App.css';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [surveyData, setSurveyData] = useState({});
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('selectedLanguage') || 'en';
    setLanguage(savedLang);
    i18n.changeLanguage(savedLang);
  }, []);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('selectedLanguage', lang);
  };

  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <div className="App">
          <header className="app-header">
            <div className="header-content">
              <img 
                src="https://progressconnect.ca/wp-content/uploads/2023/10/BCC-PC-Light-Pink-Pantone-250.png" 
                alt="BCC Logo" 
                className="logo"
              />
              <h1 className="app-title">{i18n.t('app_title')}</h1>
              <LanguageSwitcher 
                currentLanguage={language} 
                onLanguageChange={handleLanguageChange} 
              />
            </div>
          </header>
          
          <main className="app-main">
            <Routes>
              <Route 
                path="/" 
                element={
                  <SurveyWizard 
                    currentStep={currentStep}
                    setCurrentStep={setCurrentStep}
                    surveyData={surveyData}
                    setSurveyData={setSurveyData}
                  />
                } 
              />
              <Route path="/thank-you" element={<ThankYouPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </I18nextProvider>
  );
};

export default App;