import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

// Translation resources
const resources = {
  en: {
    translation: {
      // Basic UI
      app_title: 'PROgress CONNECT Patient Portal',
      yes: 'Yes',
      no: 'No',
      cancel: 'Cancel',
      exit: 'Exit',
      select: 'select',
      
      // Navigation
      prev_text: 'Previous',
      next_text: 'Next',
      submit_btn: 'Submit Survey',
      
      // Consent
      consent_title: "Let's Get Started!",
      consent_text: "Please make sure you have your <strong>pathology report</strong> handy, as you will need this information to answer some questions.",
      disclaimer_text: "<strong>DISCLAIMER:</strong> The tool and the information provided are not intended to replace the medical advice of your treating physician.",
      intro_text: "<strong>Introduction:</strong> The information used to generate the report will be reviewed and updated as appropriate based on the most current evidence.",
      consent_label: "Do you wish to continue?",
      please_continue: "please continue",
      
      // Email
      email_title: "Email Consent",
      email_text: "By providing your email and clicking <strong>Next</strong>, you consent to receive communications from Breast Cancer Canada.",
      privacy_link: "We value your privacy and will not share your email address.",
      email_label: "Email Address",
      email_placeholder: "you@example.com",
      
      // Privacy
      privacy_title: "Privacy Statement",
      privacy_text: "All data is being collected and stored by BCC, a registered Canadian non-profit organization.",
      privacy_consent_label: "Do you agree with the following statement:",
      privacy_consent: "I agree that this information is being provided voluntarily and consent to its use by BCC.",
      privacy_agree_label: "Do you consent?",
      i_consent: "I consent",
      
      // Report upload
      report_title: "Pathology Report",
      report_question: "Do you want to upload your report?",
      drag_drop_or_click: "Drag & drop files here, or click to select",
      drop_files_here: "Drop the files here...",
      upload_help: "You can upload multiple reports (PDF/JPG/PNG)",
      upload_successful: "Files uploaded successfully",
      upload_error: "Error uploading files",
      upload_required: "Please upload at least one file",
      
      // Patient info
      patient_info_title: "Patient Information",
      age_label: "Age at breast cancer diagnosis",
      province_label: "Province/State",
      province_placeholder: "e.g. ON, NY, CA",
      country_label: "Country",
      select_country: "Select country",
      canada: "Canada",
      usa: "United States",
      other: "Other",
      
      // Analysis
      analysis_title: "Report Analysis",
      analysis_text: "Based on your report, we extracted the following data:",
      extracted_from_report: "Extracted from report",
      
      // Stage selection
      stage_select_label: "Select Your Cancer Stage",
      select_stage: "Select your cancer stage",
      stage0: "DCIS / Stage 0",
      stage1: "Stage I",
      stage2: "Stage II",
      stage3: "Stage III",
      stage4: "Stage IV",
      
      // Stage confirmation
      stage_title: "Confirm Your Cancer Stage",
      stage_selected_text: "You selected:",
      stage_text: "Based on your selection, we'll generate your <strong>BCC Recommended Package</strong>.",
      stage_confirm_label: "Is this correct?",
      proceed: "proceed",
      let_me_change: "let me change",
      
      // Review
      review_title: "Review & Submit",
      your_responses: "Your Responses",
      generating: "Generating your BCC Recommended Package...",
      
      // Thank you
      thank_you: "Thank You!",
      submission_received: "Your submission has been received.",
      selected_stage: "Selected Stage",
      calculated_stage: "System Calculated Stage",
      bcc_package: "BCC Recommended Package",
      ai_summary: "AI-Generated Personalized Summary",
      summary_text: "This comprehensive summary was generated based on your uploaded documents and survey responses.",
      download_btn: "Download Your BCC Recommended Package",
      email_sent: "A copy of your responses has been sent to your email address.",
      start_new_survey: "Start New Survey",
      
      // Exit
      exit_survey: "Exit Survey",
      exit_text: "Are you sure you want to exit the survey? Your progress will be lost.",
      
      // Errors
      required_field: "This field is required",
      invalid_email: "Please enter a valid email address",
      please_complete_required: "Please complete all required fields",
      submission_failed: "Submission failed. Please try again.",
      error_loading_survey: "Error loading survey. Please refresh the page.",
      
      // Status
      not_tested: "Not tested",
      not_detected: "Not detected",
      not_specified: "Not specified"
    }
  },
  fr: {
    translation: {
      // Basic UI
      app_title: 'Portail Patient PROgress CONNECT',
      yes: 'Oui',
      no: 'Non',
      cancel: 'Annuler',
      exit: 'Quitter',
      select: 'sélectionner',
      
      // Navigation
      prev_text: 'Précédent',
      next_text: 'Suivant',
      submit_btn: "Soumettre l'enquête",
      
      // Consent
      consent_title: "Commençons!",
      consent_text: "Veuillez vous assurer d'avoir votre <strong>rapport de pathologie</strong> à portée de main.",
      disclaimer_text: "<strong>AVERTISSEMENT:</strong> L'outil et les informations fournies ne visent pas à remplacer les conseils médicaux.",
      intro_text: "<strong>Introduction:</strong> Les informations seront examinées et mises à jour en fonction des preuves les plus récentes.",
      consent_label: "Souhaitez-vous continuer?",
      please_continue: "veuillez continuer",
      
      // Email
      email_title: "Consentement par courriel",
      email_text: "En fournissant votre courriel et en cliquant sur <strong>Suivant</strong>, vous consentez à recevoir des communications.",
      privacy_link: "Nous respectons votre vie privée et ne partagerons pas votre adresse courriel.",
      email_label: "Adresse courriel",
      email_placeholder: "vous@exemple.com",
      
      // Privacy
      privacy_title: "Déclaration de confidentialité",
      privacy_text: "Toutes les données sont recueillies et stockées par BCC, un organisme canadien sans but lucratif.",
      privacy_consent_label: "Êtes-vous d'accord avec la déclaration suivante:",
      privacy_consent: "Je suis d'accord que ces informations sont fournies volontairement.",
      privacy_agree_label: "Consentez-vous?",
      i_consent: "Je consens",
      
      // Report upload
      report_title: "Rapport de pathologie",
      report_question: "Souhaitez-vous télécharger votre rapport?",
      drag_drop_or_click: "Glissez-déposez les fichiers ici, ou cliquez pour sélectionner",
      drop_files_here: "Déposez les fichiers ici...",
      upload_help: "Vous pouvez télécharger plusieurs rapports (PDF/JPG/PNG)",
      upload_successful: "Fichiers téléchargés avec succès",
      upload_error: "Erreur lors du téléchargement",
      upload_required: "Veuillez télécharger au moins un fichier",
      
      // Patient info
      patient_info_title: "Informations sur le patient",
      age_label: "Âge au moment du diagnostic",
      province_label: "Province/État",
      province_placeholder: "p.ex. QC, NY, CA",
      country_label: "Pays",
      select_country: "Sélectionnez un pays",
      canada: "Canada",
      usa: "États-Unis",
      other: "Autre",
      
      // Analysis
      analysis_title: "Analyse du rapport",
      analysis_text: "Sur la base de votre rapport, nous avons extrait les données suivantes:",
      extracted_from_report: "Extrait du rapport",
      
      // Stage selection
      stage_select_label: "Sélectionnez votre stade de cancer",
      select_stage: "Sélectionnez votre stade",
      stage0: "CCIS / Stade 0",
      stage1: "Stade I",
      stage2: "Stade II",
      stage3: "Stade III",
      stage4: "Stade IV",
      
      // Stage confirmation
      stage_title: "Confirmez votre stade de cancer",
      stage_selected_text: "Vous avez sélectionné:",
      stage_text: "Nous générerons votre <strong>Ensemble de recommandations BCC</strong>.",
      stage_confirm_label: "Est-ce correct?",
      proceed: "procéder",
      let_me_change: "laissez-moi changer",
      
      // Review
      review_title: "Vérifier et soumettre",
      your_responses: "Vos réponses",
      generating: "Génération de votre ensemble de recommandations BCC...",
      
      // Thank you
      thank_you: "Merci!",
      submission_received: "Votre soumission a été reçue.",
      selected_stage: "Stade sélectionné",
      calculated_stage: "Stade calculé par le système",
      bcc_package: "Ensemble de recommandations BCC",
      ai_summary: "Résumé personnalisé généré par l'IA",
      summary_text: "Ce résumé a été généré sur la base de vos documents et réponses.",
      download_btn: "Télécharger votre ensemble de recommandations",
      email_sent: "Une copie de vos réponses a été envoyée à votre courriel.",
      start_new_survey: "Commencer une nouvelle enquête",
      
      // Exit
      exit_survey: "Quitter l'enquête",
      exit_text: "Êtes-vous sûr de vouloir quitter? Votre progression sera perdue.",
      
      // Errors
      required_field: "Ce champ est obligatoire",
      invalid_email: "Veuillez entrer une adresse courriel valide",
      please_complete_required: "Veuillez remplir tous les champs obligatoires",
      submission_failed: "Échec de la soumission. Veuillez réessayer.",
      error_loading_survey: "Erreur lors du chargement. Veuillez actualiser la page.",
      
      // Status
      not_tested: "Non testé",
      not_detected: "Non détecté",
      not_specified: "Non spécifié"
    }
  }
};

// Load additional translations from backend
const loadTranslations = async (lang) => {
  try {
    const response = await axios.get(`${API_URL}/api/translations/${lang}`);
    return response.data;
  } catch (error) {
    console.error('Error loading translations:', error);
    return null;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },
    
    interpolation: {
      escapeValue: false
    },
    
    react: {
      useSuspense: false
    }
  });

// Load backend translations on init
['en', 'fr'].forEach(async (lang) => {
  const translations = await loadTranslations(lang);
  if (translations) {
    i18n.addResourceBundle(lang, 'translation', translations, true, true);
  }
});

export default i18n;
