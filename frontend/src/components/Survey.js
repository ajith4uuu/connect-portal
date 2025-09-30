import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Stepper, Step, StepLabel,
  Button, TextField, Radio, RadioGroup, FormControlLabel,
  FormControl, FormLabel, Select, MenuItem, Checkbox,
  FormGroup, Typography, LinearProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { CloudUpload, NavigateNext, NavigateBefore } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

function Survey({ onComplete }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [activeStep, setActiveStep] = useState(0);
  const [surveyDefinition, setSurveyDefinition] = useState([]);
  const [formData, setFormData] = useState({
    consent: '',
    email: '',
    privacy: '',
    wantUpload: '',
    age: '',
    province: '',
    country: '',
    stage: '',
    stageConfirm: ''
  });
  const [extractedData, setExtractedData] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [exitDialog, setExitDialog] = useState(false);

  // Static steps before dynamic questions
  const staticSteps = [
    t('consent_title'),
    t('email_title'),
    t('privacy_title'),
    t('report_title'),
    t('analysis_title'),
    t('stage_title')
  ];

  // Total steps calculation
  const totalSteps = staticSteps.length + surveyDefinition.length + 1; // +1 for review

  useEffect(() => {
    loadSurveyDefinition();
  }, [i18n.language]);

  const loadSurveyDefinition = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/survey/${i18n.language}`);
      setSurveyDefinition(response.data);
    } catch (error) {
      toast.error(t('error_loading_survey'));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 10,
    onDrop: acceptedFiles => {
      setFiles(acceptedFiles);
      if (acceptedFiles.length > 0) {
        handleFileUpload(acceptedFiles);
      }
    }
  });

  const handleFileUpload = async (uploadFiles) => {
    setUploading(true);
    const formData = new FormData();
    
    uploadFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('lang', i18n.language);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setExtractedData(response.data.data);
      
      // Prefill form with extracted data
      setFormData(prev => ({
        ...prev,
        age: response.data.data.age || prev.age,
        province: response.data.data.province || prev.province,
        country: response.data.data.country || prev.country,
        stage: response.data.data.stage || prev.stage
      }));
      
      toast.success(t('upload_successful'));
    } catch (error) {
      toast.error(t('upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    switch(step) {
      case 0: // Consent
        if (!formData.consent) newErrors.consent = t('required_field');
        break;
      case 1: // Email
        if (!formData.email) newErrors.email = t('required_field');
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email)) {
          newErrors.email = t('invalid_email');
        }
        break;
      case 2: // Privacy
        if (!formData.privacy) newErrors.privacy = t('required_field');
        break;
      case 3: // Upload
        if (!formData.wantUpload) newErrors.wantUpload = t('required_field');
        if (formData.wantUpload === 'yes' && files.length === 0) {
          newErrors.files = t('upload_required');
        }
        if (!formData.age) newErrors.age = t('required_field');
        if (!formData.province) newErrors.province = t('required_field');
        if (!formData.country) newErrors.country = t('required_field');
        break;
      case 4: // Stage selection
        if (!formData.stage) newErrors.stage = t('required_field');
        break;
      case 5: // Stage confirmation
        if (!formData.stageConfirm) newErrors.stageConfirm = t('required_field');
        break;
      default:
        // Dynamic questions validation
        if (step >= staticSteps.length && step < staticSteps.length + surveyDefinition.length) {
          const question = surveyDefinition[step - staticSteps.length];
          if (question.required && !formData[question.id]) {
            newErrors[question.id] = t('required_field');
          }
        }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(activeStep)) {
      toast.error(t('please_complete_required'));
      return;
    }
    
    // Check for exit conditions
    if (activeStep === 0 && formData.consent === 'no') {
      setExitDialog(true);
      return;
    }
    if (activeStep === 2 && formData.privacy === 'no') {
      setExitDialog(true);
      return;
    }
    if (activeStep === 5 && formData.stageConfirm === 'no') {
      setActiveStep(4); // Go back to stage selection
      return;
    }
    
    if (activeStep < totalSteps - 1) {
      setActiveStep(activeStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    // Collect all dynamic question answers
    const dynamicAnswers = {};
    surveyDefinition.forEach(q => {
      dynamicAnswers[q.id] = formData[q.id] || '';
    });
    
    const submitData = {
      extracted: extractedData,
      answers: { ...formData, ...dynamicAnswers },
      lang: i18n.language
    };

    try {
      const response = await axios.post(`${API_URL}/api/submit`, submitData);
      
      if (response.data.success) {
        onComplete(response.data.data);
        navigate('/thank-you');
      }
    } catch (error) {
      toast.error(t('submission_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch(activeStep) {
      case 0: // Consent
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('consent_title')}</Typography>
            <Typography paragraph dangerouslySetInnerHTML={{ __html: t('consent_text') }} />
            <Typography paragraph dangerouslySetInnerHTML={{ __html: t('disclaimer_text') }} />
            <Typography paragraph dangerouslySetInnerHTML={{ __html: t('intro_text') }} />
            
            <FormControl component="fieldset" error={!!errors.consent}>
              <FormLabel component="legend">{t('consent_label')} *</FormLabel>
              <RadioGroup
                value={formData.consent}
                onChange={(e) => setFormData({...formData, consent: e.target.value})}
              >
                <FormControlLabel value="yes" control={<Radio />} label={`${t('yes')}, ${t('please_continue')}`} />
                <FormControlLabel value="no" control={<Radio />} label={`${t('no')}, ${t('exit_survey')}`} />
              </RadioGroup>
            </FormControl>
          </Box>
        );
        
      case 1: // Email
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('email_title')}</Typography>
            <Typography paragraph dangerouslySetInnerHTML={{ __html: t('email_text') }} />
            <Typography paragraph>{t('privacy_link')}</Typography>
            
            <TextField
              fullWidth
              label={`${t('email_label')} *`}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              error={!!errors.email}
              helperText={errors.email}
              placeholder={t('email_placeholder')}
              margin="normal"
            />
          </Box>
        );
        
      case 2: // Privacy
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('privacy_title')}</Typography>
            <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderLeft: '4px solid #53868b', mb: 2 }}>
              <Typography paragraph>{t('privacy_text')}</Typography>
            </Box>
            <Typography paragraph>{t('privacy_consent_label')}</Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 2 }}>
              "{t('privacy_consent')}"
            </Typography>
            
            <FormControl component="fieldset" error={!!errors.privacy}>
              <FormLabel component="legend">{t('privacy_agree_label')} *</FormLabel>
              <RadioGroup
                value={formData.privacy}
                onChange={(e) => setFormData({...formData, privacy: e.target.value})}
              >
                <FormControlLabel value="yes" control={<Radio />} label={`${t('yes')}, ${t('i_consent')}`} />
                <FormControlLabel value="no" control={<Radio />} label={`${t('no')}, ${t('exit_survey')}`} />
              </RadioGroup>
            </FormControl>
          </Box>
        );
        
      case 3: // Upload
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('report_title')}</Typography>
            
            <FormControl component="fieldset" error={!!errors.wantUpload} sx={{ mb: 3 }}>
              <FormLabel component="legend">{t('report_question')} *</FormLabel>
              <RadioGroup
                value={formData.wantUpload}
                onChange={(e) => setFormData({...formData, wantUpload: e.target.value})}
              >
                <FormControlLabel value="yes" control={<Radio />} label={t('yes')} />
                <FormControlLabel value="no" control={<Radio />} label={t('no')} />
              </RadioGroup>
            </FormControl>
            
            {formData.wantUpload === 'yes' && (
              <Box {...getRootProps()} sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 3,
                mb: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragActive ? '#f0f0f0' : 'transparent'
              }}>
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                <Typography>
                  {isDragActive ? t('drop_files_here') : t('drag_drop_or_click')}
                </Typography>
                <Typography variant="caption">{t('upload_help')}</Typography>
                {files.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {files.map((file, index) => (
                      <Typography key={index} variant="body2">
                        {file.name} ({Math.round(file.size / 1024)} KB)
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
            
            {uploading && <LinearProgress sx={{ mb: 2 }} />}
            
            <Typography variant="h6" gutterBottom>{t('patient_info_title')}</Typography>
            
            <TextField
              fullWidth
              label={`${t('age_label')} *`}
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({...formData, age: e.target.value})}
              error={!!errors.age}
              helperText={errors.age || (extractedData.age && t('extracted_from_report'))}
              margin="normal"
              InputProps={{ inputProps: { min: 18, max: 120 } }}
            />
            
            <TextField
              fullWidth
              label={`${t('province_label')} *`}
              value={formData.province}
              onChange={(e) => setFormData({...formData, province: e.target.value})}
              error={!!errors.province}
              helperText={errors.province || (extractedData.province && t('extracted_from_report'))}
              placeholder={t('province_placeholder')}
              margin="normal"
            />
            
            <FormControl fullWidth margin="normal" error={!!errors.country}>
              <Select
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
                displayEmpty
              >
                <MenuItem value="">— {t('select_country')} —</MenuItem>
                <MenuItem value="Canada">{t('canada')}</MenuItem>
                <MenuItem value="United States">{t('usa')}</MenuItem>
                <MenuItem value="Other">{t('other')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );
        
      case 4: // Stage selection
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('analysis_title')}</Typography>
            
            {extractedData && (
              <Box sx={{ bgcolor: '#f8d7e4', p: 2, borderLeft: '4px solid #e5317a', mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {t('analysis_text')}
                </Typography>
                <Typography>ER/PR: {extractedData.ERPR || t('not_tested')}</Typography>
                <Typography>HER2: {extractedData.HER2 || t('not_tested')}</Typography>
                <Typography>BRCA: {extractedData.BRCA || t('not_tested')}</Typography>
                <Typography>Stage: {extractedData.stage || t('not_detected')}</Typography>
              </Box>
            )}
            
            <FormControl fullWidth error={!!errors.stage}>
              <FormLabel>{t('stage_select_label')} *</FormLabel>
              <Select
                value={formData.stage}
                onChange={(e) => setFormData({...formData, stage: e.target.value})}
                displayEmpty
              >
                <MenuItem value="">— {t('select_stage')} —</MenuItem>
                <MenuItem value="DCIS / Stage 0">{t('stage0')}</MenuItem>
                <MenuItem value="Stage I">{t('stage1')}</MenuItem>
                <MenuItem value="Stage II">{t('stage2')}</MenuItem>
                <MenuItem value="Stage III">{t('stage3')}</MenuItem>
                <MenuItem value="Stage IV">{t('stage4')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );
        
      case 5: // Stage confirmation
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('stage_title')}</Typography>
            
            <Box sx={{ bgcolor: '#f8d7e4', p: 2, borderLeft: '4px solid #e5317a', mb: 3, textAlign: 'center' }}>
              <Typography variant="h6">
                {t('stage_selected_text')} <strong>{formData.stage}</strong>
              </Typography>
            </Box>
            
            <Typography paragraph dangerouslySetInnerHTML={{ __html: t('stage_text') }} />
            
            <FormControl component="fieldset" error={!!errors.stageConfirm}>
              <FormLabel component="legend">{t('stage_confirm_label')} *</FormLabel>
              <RadioGroup
                value={formData.stageConfirm}
                onChange={(e) => setFormData({...formData, stageConfirm: e.target.value})}
              >
                <FormControlLabel value="yes" control={<Radio />} label={`${t('yes')}, ${t('proceed')}`} />
                <FormControlLabel value="no" control={<Radio />} label={`${t('no')}, ${t('let_me_change')}`} />
              </RadioGroup>
            </FormControl>
          </Box>
        );
        
      default:
        // Dynamic questions
        if (activeStep >= staticSteps.length && activeStep < staticSteps.length + surveyDefinition.length) {
          const question = surveyDefinition[activeStep - staticSteps.length];
          return renderDynamicQuestion(question);
        }
        
        // Review step
        if (activeStep === totalSteps - 1) {
          return renderReview();
        }
        
        return null;
    }
  };

  const renderDynamicQuestion = (question) => {
    const value = formData[question.id] || '';
    const error = errors[question.id];
    
    switch(question.type) {
      case 'select':
        return (
          <Box>
            <FormControl fullWidth error={!!error}>
              <FormLabel>{question.title}</FormLabel>
              <Select
                value={value}
                onChange={(e) => setFormData({...formData, [question.id]: e.target.value})}
                displayEmpty
              >
                <MenuItem value="">— {t('select')} —</MenuItem>
                {question.options?.map((option, idx) => (
                  <MenuItem key={idx} value={option}>{option}</MenuItem>
                ))}
              </Select>
              {error && <Typography color="error" variant="caption">{error}</Typography>}
            </FormControl>
          </Box>
        );
        
      case 'radio':
        return (
          <Box>
            <FormControl component="fieldset" error={!!error}>
              <FormLabel>{question.title}</FormLabel>
              <RadioGroup
                value={value}
                onChange={(e) => setFormData({...formData, [question.id]: e.target.value})}
              >
                {question.options?.map((option, idx) => (
                  <FormControlLabel key={idx} value={option} control={<Radio />} label={option} />
                ))}
              </RadioGroup>
              {error && <Typography color="error" variant="caption">{error}</Typography>}
            </FormControl>
          </Box>
        );
        
      case 'checkbox':
        const checkedValues = Array.isArray(value) ? value : [];
        return (
          <Box>
            <FormControl component="fieldset" error={!!error}>
              <FormLabel>{question.title}</FormLabel>
              <FormGroup>
                {question.options?.map((option, idx) => (
                  <FormControlLabel
                    key={idx}
                    control={
                      <Checkbox
                        checked={checkedValues.includes(option)}
                        onChange={(e) => {
                          let newValues = [...checkedValues];
                          if (e.target.checked) {
                            newValues.push(option);
                          } else {
                            newValues = newValues.filter(v => v !== option);
                          }
                          setFormData({...formData, [question.id]: newValues});
                        }}
                      />
                    }
                    label={option}
                  />
                ))}
              </FormGroup>
              {error && <Typography color="error" variant="caption">{error}</Typography>}
            </FormControl>
          </Box>
        );
        
      default:
        return (
          <Box>
            <TextField
              fullWidth
              label={question.title}
              type={question.type || 'text'}
              value={value}
              onChange={(e) => setFormData({...formData, [question.id]: e.target.value})}
              error={!!error}
              helperText={error}
              placeholder={question.placeholder}
              margin="normal"
            />
          </Box>
        );
    }
  };

  const renderReview = () => {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>{t('review_title')}</Typography>
        
        <Box sx={{ bgcolor: '#f8d7e4', p: 2, borderLeft: '4px solid #e5317a', mb: 3 }}>
          <Typography variant="subtitle1">
            {t('selected_stage')}: <strong>{formData.stage}</strong>
          </Typography>
        </Box>
        
        <Typography variant="h6" gutterBottom>{t('your_responses')}</Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography><strong>{t('email_label')}:</strong> {formData.email}</Typography>
          <Typography><strong>{t('age_label')}:</strong> {formData.age}</Typography>
          <Typography><strong>{t('province_label')}:</strong> {formData.province}</Typography>
          <Typography><strong>{t('country_label')}:</strong> {formData.country}</Typography>
          
          {surveyDefinition.map(q => {
            const value = formData[q.id];
            if (!value) return null;
            
            return (
              <Typography key={q.id}>
                <strong>{q.title}:</strong> {
                  Array.isArray(value) ? value.join(', ') : value
                }
              </Typography>
            );
          })}
        </Box>
        
        {submitting && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              {t('generating')}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {[...staticSteps, ...surveyDefinition.map(q => q.title.substring(0, 20)), t('review_title')].map((label, index) => (
            <Step key={index}>
              <StepLabel>{index === activeStep ? label : ''}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {renderStepContent()}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<NavigateBefore />}
          >
            {t('prev_text')}
          </Button>
          
          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={activeStep < totalSteps - 1 ? <NavigateNext /> : null}
            disabled={submitting}
          >
            {activeStep === totalSteps - 1 ? t('submit_btn') : t('next_text')}
          </Button>
        </Box>
      </CardContent>
      
      <Dialog open={exitDialog} onClose={() => setExitDialog(false)}>
        <DialogTitle>{t('exit_survey')}</DialogTitle>
        <DialogContent>
          <Typography>{t('exit_text')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitDialog(false)}>{t('cancel')}</Button>
          <Button onClick={() => navigate('/')} color="error">{t('exit')}</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default Survey;
