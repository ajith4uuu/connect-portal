import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './ThankYouPage.css';

interface SurveyResult {
  userStage: string;
  calculatedStage: string;
  packages: string[];
  pdfUrl?: string;
  summary?: string;
  surveyId?: string;
}

const ThankYouPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [resultData, setResultData] = useState<SurveyResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedResult = localStorage.getItem('surveyResult');
    if (savedResult) {
      setResultData(JSON.parse(savedResult));
    }
    setIsLoading(false);

    // Clear the saved result after displaying
    return () => {
      localStorage.removeItem('surveyResult');
    };
  }, []);

  const handleStartNewSurvey = () => {
    localStorage.clear();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="thank-you-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="thank-you-page">
        <div className="thank-you-card">
          <h2>{t('thank_you')}</h2>
          <p>{t('session_expired')}</p>
          <button className="btn btn-primary" onClick={handleStartNewSurvey}>
            {t('start_new_survey')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thank-you-page">
      <div className="thank-you-card">
        <div className="success-icon">✅</div>
        <h1>{t('thank_you')}</h1>
        <p className="subtitle">{t('submission_received')}</p>
        
        <div className="result-summary">
          <h3>{t('your_results')}</h3>
          
          <div className="result-grid">
            <div className="result-item">
              <span className="label">{t('selected_stage')}</span>
              <span className="value">{resultData.userStage}</span>
            </div>
            
            <div className="result-item">
              <span className="label">{t('calculated_stage')}</span>
              <span className="value">{resultData.calculatedStage}</span>
            </div>
            
            <div className="result-item full-width">
              <span className="label">{t('bcc_package')}</span>
              <span className="value">{resultData.packages.join(', ')}</span>
            </div>
          </div>
        </div>

        {resultData.pdfUrl && (
          <div className="download-section">
            <h3>{t('download_resources')}</h3>
            <a 
              href={resultData.pdfUrl} 
              className="download-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 {t('download_btn')}
            </a>
          </div>
        )}

        {resultData.summary && (
          <div className="ai-summary">
            <h3>{t('ai_summary')}</h3>
            <div className="summary-content">
              <p className="summary-intro">
                <em>{t('summary_generated')}</em>
              </p>
              <div className="summary-text">
                {resultData.summary.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="important-notice">
          <h4>⚠️ {t('important_note')}</h4>
          <p>{t('consult_doctor')}</p>
        </div>

        <div className="email-notice">
          <p>📧 {t('email_sent')}</p>
        </div>

        <div className="thank-you-actions">
          <button className="btn btn-secondary" onClick={handleStartNewSurvey}>
            {t('start_new_survey')}
          </button>
          
          {resultData.surveyId && (
            <button 
              className="btn btn-outline" 
              onClick={() => navigator.clipboard.writeText(resultData.surveyId!)}
            >
              {t('copy_survey_id')}
            </button>
          )}
        </div>

        <div className="footer">
          <p>{t('best_regards')}</p>
          <p><strong>{t('team_name')}</strong></p>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;