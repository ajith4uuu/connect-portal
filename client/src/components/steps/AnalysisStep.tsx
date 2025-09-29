import React from 'react';
import { useTranslation } from 'react-i18next';

interface AnalysisStepProps {
  surveyData: any;
  setSurveyData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
  extractedData: any;
}

const AnalysisStep: React.FC<AnalysisStepProps> = ({ 
  surveyData, 
  setSurveyData, 
  onNext, 
  extractedData 
}) => {
  const { t } = useTranslation();

  const handleStageChange = (stage: string) => {
    setSurveyData({ ...surveyData, stage });
  };

  return (
    <section className="step active" id="s4">
      <h2>{t('analysis_title')}</h2>
      
      <div className="stage-confirm">
        <p dangerouslySetInnerHTML={{ __html: t('analysis_text') }} />
        
        <ul className="extracted-data-list" id="extractedDataList">
          <li id="erpr-data">
            {t('erpr_data')}: {extractedData.ERPR || t('not_tested')}
          </li>
          <li id="her2-data">
            {t('her2_data')}: {extractedData.HER2 || t('not_tested')}
          </li>
          <li id="brca-data">
            {t('brca_data')}: {extractedData.BRCA || t('not_tested')}
          </li>
          <li id="stage-data">
            {t('stage_data')}: {extractedData.stage || t('not_detected')}
          </li>
        </ul>
      </div>
      
      <label dangerouslySetInnerHTML={{ __html: t('stage_select_label') }} />
      
      <select 
        id="stageSelect" 
        value={surveyData.stage || ''}
        onChange={(e) => handleStageChange(e.target.value)}
        required
      >
        <option value="">— {t('select_stage')} —</option>
        <option value="DCIS / Stage 0">{t('stage0')}</option>
        <option value="Stage I">{t('stage1')}</option>
        <option value="Stage II">{t('stage2')}</option>
        <option value="Stage III">{t('stage3')}</option>
        <option value="Stage IV">{t('stage4')}</option>
      </select>
    </section>
  );
};

export default AnalysisStep;