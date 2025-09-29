import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EmailStepProps {
  surveyData: any;
  setSurveyData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
}

const EmailStep: React.FC<EmailStepProps> = ({ 
  surveyData, 
  setSurveyData, 
  onNext 
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState(surveyData.email || '');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setSurveyData({ ...surveyData, email: value });
    
    if (validateEmail(value)) {
      setEmailError('');
      setTimeout(onNext, 100);
    } else {
      setEmailError(t('email_error'));
    }
  };

  return (
    <section className="step active" id="s1">
      <h2>{t('email_title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('email_text') }} />
      <p dangerouslySetInnerHTML={{ __html: t('privacy_link') }} />
      
      <label dangerouslySetInnerHTML={{ __html: t('email_label') }} />
      <input 
        type="email" 
        id="email"
        value={email}
        onChange={(e) => handleEmailChange(e.target.value)}
        placeholder={t('email_placeholder')}
        required
      />
      
      {emailError && (
        <div id="mailErr" className="error">
          {emailError}
        </div>
      )}
    </section>
  );
};

export default EmailStep;