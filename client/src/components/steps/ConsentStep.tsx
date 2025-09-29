import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConsentStepProps {
  surveyData: any;
  setSurveyData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
}

const ConsentStep: React.FC<ConsentStepProps> = ({ 
  surveyData, 
  setSurveyData, 
  onNext 
}) => {
  const { t } = useTranslation();
  const [consent, setConsent] = useState(surveyData.consent || '');

  const handleConsentChange = (value: string) => {
    setConsent(value);
    setSurveyData({ ...surveyData, consent: value });
    
    if (value === 'yes') {
      setTimeout(onNext, 100);
    } else if (value === 'no') {
      // Handle exit
      window.location.href = '/exit';
    }
  };

  return (
    <section className="step active" id="s0">
      <h2>{t('consent_title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('consent_text') }} />
      <p dangerouslySetInnerHTML={{ __html: t('disclaimer_text') }} />
      <p dangerouslySetInnerHTML={{ __html: t('intro_text') }} />
      
      <label dangerouslySetInnerHTML={{ __html: t('consent_label') }} />
      
      <div className="inline">
        <label>
          <input 
            type="radio" 
            name="consent" 
            value="yes" 
            checked={consent === 'yes'}
            onChange={(e) => handleConsentChange(e.target.value)}
            required
          />
          {t('yes_text')}, {t('consent_text').toLowerCase()}
        </label>
        <label>
          <input 
            type="radio" 
            name="consent" 
            value="no" 
            checked={consent === 'no'}
            onChange={(e) => handleConsentChange(e.target.value)}
            required
          />
          {t('no_text')}, {t('exit_survey').toLowerCase()}
        </label>
      </div>
    </section>
  );
};

export default ConsentStep;