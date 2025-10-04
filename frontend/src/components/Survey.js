import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Stepper, Step, StepLabel,
  Button, TextField, Radio, RadioGroup, FormControlLabel,
  FormControl, FormLabel, Select, MenuItem, Checkbox,
  FormGroup, Typography, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { CloudUpload, NavigateNext, NavigateBefore } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';
const DOC_API_URL = process.env.REACT_APP_DOC_API_URL || '';

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
    cancerType: '',
    stageConfirm: ''
  });
  const [extractedData, setExtractedData] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [exitDialog, setExitDialog] = useState(false);
  const manualFileInputRef = useRef(null);

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);


  // Static steps before dynamic questions
  const staticSteps = [
    t('consent_title'),
    t('email_title'),
    t('privacy_title'),
    t('report_title'),
    t('analysis_title'),
    t('cancer_type_step'),
    t('stage_title')
  ];

  // Total steps calculation
  const totalSteps = staticSteps.length + surveyDefinition.length + 1; // +1 for review

  // Define before useEffect to satisfy eslint no-use-before-define
  const loadSurveyDefinition = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/survey/${i18n.language}`);
      setSurveyDefinition(response.data);
    } catch (error) {
      toast.error(t('error_loading_survey'));
    }
  }, [i18n.language, t]);

  useEffect(() => {
    loadSurveyDefinition();
  }, [loadSurveyDefinition]);

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

  const handleManualSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles(prev => [...prev, ...selected]);
    handleFileUpload(selected);
    e.target.value = '';
  };

  const sendOtp = async () => {
    const email = (formData.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErrors(prev => ({ ...prev, email: t('invalid_email') }));
      return;
    }
    try {
      setOtpSending(true);
      await axios.post(`${API_URL}/api/otp/send`, { email, lang: i18n.language });
      setOtpSent(true);
      toast.success(t('otp_sent'));
    } catch (e) {
      const msg = e?.response?.data?.error || t('submission_failed');
      toast.error(msg);
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    const code = (otpCode || '').replace(/\s+/g, '');
    const email = (formData.email || '').trim().toLowerCase();
    if (!code) {
      setErrors(prev => ({ ...prev, otp: t('required_field') }));
      return;
    }
    try {
      setOtpVerifying(true);
      const resp = await axios.post(`${API_URL}/api/otp/verify`, { email, code });
      if (resp.data?.success) {
        setOtpVerified(true);
        toast.success(t('otp_verified'));
        setErrors(prev => ({ ...prev, otp: undefined }));
      } else {
        setOtpVerified(false);
        setErrors(prev => ({ ...prev, otp: t('otp_invalid') }));
      }
    } catch (e) {
      const msg = e?.response?.data?.error || t('otp_invalid');
      setOtpVerified(false);
      setErrors(prev => ({ ...prev, otp: msg }));
      toast.error(msg);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleFileUpload = async (uploadFiles) => {
    setUploading(true);
    const formData = new FormData();
    
    uploadFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('lang', i18n.language);

    try {
      const endpoint = DOC_API_URL || `${API_URL}/api/upload`;
      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const payload = response.data?.data || response.data || {};
      setExtractedData(payload);

      // Normalize stage to the base option label for the select (e.g., "Stage II TNBC" -> "Stage II")
      const normalizedStage = (() => {
        const s = String(payload.stage || '').trim();
        if (/^Stage\s+(0|I{1,3}|IV)\b/i.test(s)) {
          const m = s.match(/^(Stage\s+(?:0|I{1,3}|IV))/i);
          return m ? m[1].replace(/\s+/g, ' ') : '';
        }
        if (/DCIS/i.test(s)) return 'DCIS / Stage 0';
        return s;
      })();

      // Prefill form with extracted data, mapping to dynamic fields when possible
      setFormData(prev => ({
        ...prev,
        age: payload.age || prev.age,
        province: payload.province || prev.province,
        country: payload.country || prev.country,
        stage: normalizedStage || prev.stage,
        ERPR: payload.ERPR || prev.ERPR,
        HER2: payload.HER2 || prev.HER2,
        luminal: payload.luminal || prev.luminal,
        BRCA: payload.BRCA || prev.BRCA,
        PIK3CA: payload.PIK3CA || prev.PIK3CA,
        ESR1: payload.ESR1 || prev.ESR1,
        PDL1: payload.PDL1 || prev.PDL1,
        MSI: payload.MSI || prev.MSI,
        Ki67: payload.Ki67 || prev.Ki67,
        PTEN: payload.PTEN || prev.PTEN,
        AKT1: payload.AKT1 || prev.AKT1
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
        if (!otpVerified) newErrors.otp = t('otp_required');
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
      case 5: // Cancer type
        if (!formData.cancerType) newErrors.cancerType = t('required_field');
        break;
      case 6: // Stage confirmation
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
    if (activeStep === 6 && formData.stageConfirm === 'no') {
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
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                // reset OTP state on email change
                setOtpSent(false);
                setOtpVerified(false);
                setOtpCode('');
              }}
              error={!!errors.email}
              helperText={errors.email}
              placeholder={t('email_placeholder')}
              margin="normal"
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Button
                variant="contained"
                onClick={sendOtp}
                disabled={otpSending || !formData.email || !!errors.email}
                sx={{ borderRadius: '30px' }}
              >
                {t('send_otp')}
              </Button>
              {otpSent && (
                <Typography variant="body2" sx={{ color: '#666' }}>{t('otp_sent')}</Typography>
              )}
            </Box>

            {otpSent && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label={t('otp_label')}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={t('otp_placeholder')}
                  error={!!errors.otp}
                  helperText={errors.otp}
                  size="small"
                />
                <Button
                  variant="outlined"
                  onClick={verifyOtp}
                  disabled={otpVerifying || otpVerified}
                  sx={{ borderRadius: '30px' }}
                >
                  {t('verify_otp')}
                </Button>
                {otpVerified && (
                  <Typography variant="body2" sx={{ color: 'success.main' }}>{t('otp_verified')}</Typography>
                )}
              </Box>
            )}
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

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <input
                ref={manualFileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleManualSelect}
              />
              <Button variant="contained" startIcon={<CloudUpload />} onClick={() => manualFileInputRef.current?.click()}>
                Add another report
              </Button>
            </Box>

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
        
      case 5: // Cancer type
        return (
          <Box>
            <Typography variant="h5" gutterBottom>{t('cancer_type_title')}</Typography>
            <FormControl component="fieldset" error={!!errors.cancerType}>
              <FormLabel component="legend">{`${t('cancer_type_question')} *`}</FormLabel>
              <RadioGroup
                value={formData.cancerType}
                onChange={(e) => setFormData({ ...formData, cancerType: e.target.value })}
              >
                <FormControlLabel value={t('cancer_type_ductal')} control={<Radio />} label={t('cancer_type_ductal')} />
                <FormControlLabel value={t('cancer_type_lobular')} control={<Radio />} label={t('cancer_type_lobular')} />
                <FormControlLabel value={t('cancer_type_sarcoma')} control={<Radio />} label={t('cancer_type_sarcoma')} />
                <FormControlLabel value={t('cancer_type_inflammatory')} control={<Radio />} label={t('cancer_type_inflammatory')} />
                <FormControlLabel value={t('cancer_type_unknown')} control={<Radio />} label={t('cancer_type_unknown')} />
              </RadioGroup>
            </FormControl>
          </Box>
        );
      case 6: // Stage confirmation
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

  function renderDynamicQuestion(question) {
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

  function renderReview() {
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
          <Typography><strong>{t('cancer_type_title')}:</strong> {formData.cancerType || t('not_specified')}</Typography>

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
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
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
