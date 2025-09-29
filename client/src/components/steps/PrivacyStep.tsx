import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PrivacyStepProps {
  surveyData: any;
  setSurveyData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
}

const PrivacyStep: React.FC<PrivacyStepProps> = ({ 
  surveyData, 
  setSurveyData, 
  onNext 
}) => {
  const { t } = useTranslation();
  const [privacy, setPrivacy] = useState(surveyData.privacy || '');

  const handlePrivacyChange = (value: string) => {
    setPrivacy(value);
    setSurveyData({ ...surveyData, privacy: value });
    
    if (value === 'yes') {
      setTimeout(onNext, 100);
    } else if (value === 'no') {
      // Handle exit
      window.location.href = '/exit';
    }
  };

  return (
    <section className="step active" id="s2">
      <h2>{t('privacy_title')}</h2>
      
      <div className="privacy-box">
        <p dangerouslySetInnerHTML={{ __html: t('privacy_text') }} />
      </div>
      
      <p id="privacy-consent-label">{t('privacy_consent_label')}</p>
      <blockquote dangerouslySetInnerHTML={{ __html: t('privacy_consent') }} />
      
      <label dangerouslySetInnerHTML={{ __html: t('privacy_agree_label') }} />
      
      <div className="inline">
        <label>
          <input 
            type="radio" 
            name="privacy" 
            value="yes" 
            checked={privacy === 'yes'}
            onChange={(e) => handlePrivacyChange(e.target.value)}
            required
          />
          {t('yes_text2')}, {t('privacy_consent').toLowerCase()}
        </label>
        <label>
          <input 
            type="radio" 
            name="privacy" 
            value="no" 
            checked={privacy === 'no'}
            onChange={(e) => handlePrivacyChange(e.target.value)}
            required
          />
          {t('no_text2')}, {t('exit_survey').toLowerCase()}
        </label>
      </div>
    </section>
  );
};

export default PrivacyStep;