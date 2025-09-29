import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UploadStepProps {
  surveyData: any;
  setSurveyData: (data: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
  onFileUpload: (files: File[]) => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ 
  surveyData, 
  setSurveyData, 
  onNext, 
  isLoading, 
  onFileUpload 
}) => {
  const { t } = useTranslation();
  const [wantUpload, setWantUpload] = useState(surveyData.wantUpload || '');
  const [fileInputs, setFileInputs] = useState([{ id: 1, file: null as File | null }]);

  const handleUploadChoice = (value: string) => {
    setWantUpload(value);
    setSurveyData({ ...surveyData, wantUpload: value });
  };

  const addFileInput = () => {
    setFileInputs([...fileInputs, { id: Date.now(), file: null }]);
  };

  const removeFileInput = (id: number) => {
    if (fileInputs.length > 1) {
      setFileInputs(fileInputs.filter(input => input.id !== id));
    }
  };

  const handleFileChange = (id: number, file: File) => {
    const updatedInputs = fileInputs.map(input => 
      input.id === id ? { ...input, file } : input
    );
    setFileInputs(updatedInputs);
    
    // Auto-upload when file is selected
    const files = updatedInputs.map(input => input.file).filter(Boolean) as File[];
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  const handleNext = () => {
    if (wantUpload === 'yes') {
      const files = fileInputs.map(input => input.file).filter(Boolean) as File[];
      if (files.length > 0) {
        onFileUpload(files);
      }
    }
    onNext();
  };

  return (
    <section className="step active" id="s3">
      <h2>{t('report_title')}</h2>
      
      <label dangerouslySetInnerHTML={{ __html: t('report_question') }} />
      
      <div className="inline">
        <label>
          <input 
            type="radio" 
            name="wantUpload" 
            value="yes" 
            checked={wantUpload === 'yes'}
            onChange={(e) => handleUploadChoice(e.target.value)}
            required
          />
          {t('yes_text3')}
        </label>
        <label>
          <input 
            type="radio" 
            name="wantUpload" 
            value="no" 
            checked={wantUpload === 'no'}
            onChange={(e) => handleUploadChoice(e.target.value)}
            required
          />
          {t('no_text3')}
        </label>
      </div>

      {wantUpload === 'yes' && (
        <div id="uArea" style={{ display: 'block' }}>
          <label dangerouslySetInnerHTML={{ __html: t('upload_label') }} />
          
          <div id="fileInputsContainer">
            {fileInputs.map((input) => (
              <div key={input.id} className="file-input-row">
                <input 
                  type="file" 
                  className="fileInput" 
                  accept=".pdf,image/*"
                  onChange={(e) => e.target.files && handleFileChange(input.id, e.target.files[0])}
                  required
                />
                {fileInputs.length > 1 && (
                  <button 
                    type="button" 
                    className="remove-file-btn"
                    onClick={() => removeFileInput(input.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button 
            type="button" 
            id="addFileBtn" 
            className="add-file-btn"
            onClick={addFileInput}
          >
            +
          </button>
          
          {isLoading && (
            <div id="uStatus" className="status">
              <span className="spinner"></span> {t('analyzing_text')}
            </div>
          )}
          
          <div className="help" dangerouslySetInnerHTML={{ __html: t('upload_help') }} />
        </div>
      )}

      <h3 style={{ marginTop: '1.5rem' }}>{t('patient_info_title')}</h3>
      
      <div style={{ marginTop: '1rem' }}>
        <label dangerouslySetInnerHTML={{ __html: t('age_label') }} />
        <input 
          type="number" 
          id="age" 
          placeholder={t('age_placeholder')}
          min="18" 
          max="120"
          value={surveyData.age || ''}
          onChange={(e) => setSurveyData({ ...surveyData, age: e.target.value })}
          required
        />
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <label dangerouslySetInnerHTML={{ __html: t('province_label') }} />
        <input 
          type="text" 
          id="province" 
          placeholder={t('province_placeholder')}
          value={surveyData.province || ''}
          onChange={(e) => setSurveyData({ ...surveyData, province: e.target.value })}
          required
        />
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <label dangerouslySetInnerHTML={{ __html: t('country_label') }} />
        <select 
          id="country" 
          value={surveyData.country || ''}
          onChange={(e) => setSurveyData({ ...surveyData, country: e.target.value })}
          required
        >
          <option value="">— {t('select_country')} —</option>
          <option value="Canada">{t('canada')}</option>
          <option value="United States">{t('usa')}</option>
          <option value="Other">{t('other')}</option>
        </select>
      </div>
    </section>
  );
};

export default UploadStep;