import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import ConsentStep from './steps/ConsentStep';
import EmailStep from './steps/EmailStep';
import PrivacyStep from './steps/PrivacyStep';
import UploadStep from './steps/UploadStep';
import AnalysisStep from './steps/AnalysisStep';
import StageConfirmationStep from './steps/StageConfirmationStep';
import ReviewStep from './steps/ReviewStep';
import { surveyService } from '../services/surveyService';
import { uploadService } from '../services/uploadService';
import './SurveyWizard.css';

interface SurveyWizardProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  surveyData: any;
  setSurveyData: (data: any) => void;
}

const SurveyWizard: React.FC<SurveyWizardProps> = ({
  currentStep,
  setCurrentStep,
  surveyData,
  setSurveyData
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState({});
  const [dynamicQuestions, setDynamicQuestions] = useState<any[]>([]);

  const totalSteps = 6 + (dynamicQuestions.length > 0 ? dynamicQuestions.length + 1 : 0);

  useEffect(() => {
    // Load dynamic questions based on stage
    if (surveyData.stage) {
      loadDynamicQuestions(surveyData.stage);
    }
  }, [surveyData.stage]);

  const loadDynamicQuestions = async (stage: string) => {
    try {
      const questions = await surveyService.getSurveyQuestions(stage);
      setDynamicQuestions(questions);
    } catch (error) {
      console.error('Error loading dynamic questions:', error);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    setIsLoading(true);
    try {
      const analysisResults = await uploadService.analyzeFiles(files);
      setExtractedData(analysisResults);
      setSurveyData({ ...surveyData, ...analysisResults });
    } catch (error) {
      console.error('Error analyzing files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await surveyService.submitSurvey({
        answers: surveyData,
        extracted: extractedData
      });
      
      // Store result in localStorage for thank you page
      localStorage.setItem('surveyResult', JSON.stringify(result));
      navigate('/thank-you');
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    const stepProps = {
      surveyData,
      setSurveyData,
      onNext: handleNext,
      onPrevious: handlePrevious,
      isLoading
    };

    switch (currentStep) {
      case 0:
        return <ConsentStep {...stepProps} />;
      case 1:
        return <EmailStep {...stepProps} />;
      case 2:
        return <PrivacyStep {...stepProps} />;
      case 3:
        return <UploadStep {...stepProps} onFileUpload={handleFileUpload} />;
      case 4:
        return <AnalysisStep {...stepProps} extractedData={extractedData} />;
      case 5:
        return <StageConfirmationStep {...stepProps} />;
      case 6:
        return <ReviewStep {...stepProps} onSubmit={handleSubmit} extractedData={extractedData} dynamicQuestions={dynamicQuestions} />;
      default:
        // Dynamic question steps
        const questionIndex = currentStep - 6;
        if (questionIndex < dynamicQuestions.length) {
          return (
            <DynamicQuestionStep 
              {...stepProps} 
              question={dynamicQuestions[questionIndex]} 
            />
          );
        }
        return <ReviewStep {...stepProps} onSubmit={handleSubmit} extractedData={extractedData} dynamicQuestions={dynamicQuestions} />;
    }
  };

  return (
    <div className="survey-wizard">
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      
      <div className="wizard-content">
        {renderStep()}
      </div>

      <div className="wizard-navigation">
        <button 
          className="btn btn-secondary" 
          onClick={handlePrevious}
          disabled={currentStep === 0 || isLoading}
        >
          {t('prev_text')}
        </button>
        
        {currentStep < totalSteps - 1 ? (
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={isLoading}
          >
            {t('next_text')}
          </button>
        ) : (
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? t('generating') : t('submit_btn')}
          </button>
        )}
      </div>
    </div>
  );
};

const DynamicQuestionStep: React.FC<any> = ({ 
  question, 
  surveyData, 
  setSurveyData, 
  onNext, 
  onPrevious, 
  isLoading 
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(surveyData[question.id] || '');

  const handleChange = (newValue: any) => {
    setValue(newValue);
    setSurveyData({ ...surveyData, [question.id]: newValue });
  };

  const renderQuestion = () => {
    switch (question.type) {
      case 'select':
        return (
          <select 
            value={value} 
            onChange={(e) => handleChange(e.target.value)}
            required={question.required}
          >
            <option value="">— {t('select')} —</option>
            {question.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'radio':
        return (
          <div className="inline">
            {question.options.map((option: string) => (
              <label key={option}>
                <input 
                  type="radio" 
                  name={question.id} 
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleChange(e.target.value)}
                  required={question.required}
                />
                {option}
              </label>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <div className="inline">
            {question.options.map((option: string) => (
              <label key={option}>
                <input 
                  type="checkbox" 
                  name={question.id} 
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const newValues = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      newValues.push(option);
                    } else {
                      const index = newValues.indexOf(option);
                      if (index > -1) newValues.splice(index, 1);
                    }
                    handleChange(newValues);
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        );
      
      default:
        return (
          <input 
            type={question.type} 
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.placeholder || ''}
            required={question.required}
          />
        );
    }
  };

  return (
    <section className="step active">
      <label>
        {question.title}
        {question.required && <span className="required">*</span>}
      </label>
      {renderQuestion()}
    </section>
  );
};

export default SurveyWizard;