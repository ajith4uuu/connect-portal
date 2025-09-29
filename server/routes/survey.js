const express = require('express');
const { body, validationResult } = require('express-validator');
const BigQueryService = require('../services/bigquery');
const EmailService = require('../services/email');
const GeminiService = require('../services/gemini');
const winston = require('winston');
const router = express.Router();

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'survey.log' })
  ]
});

const bigqueryService = new BigQueryService();
const emailService = new EmailService();
const geminiService = new GeminiService();

// Initialize BigQuery on startup
bigqueryService.initialize().catch(error => {
  logger.error('Failed to initialize BigQuery:', error);
});

// Get survey questions based on stage
router.get('/questions/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    const { lang = 'en' } = req.query;
    
    const questions = getSurveyQuestions(stage, lang);
    
    res.json({
      success: true,
      questions,
      stage
    });
  } catch (error) {
    logger.error('Error getting survey questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get survey questions'
    });
  }
});

// Submit survey
router.post('/submit', [
  body('answers.email').isEmail().normalizeEmail(),
  body('answers.age').isInt({ min: 18, max: 120 }),
  body('answers.country').notEmpty(),
  body('answers.stage').notEmpty()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { answers, extracted = {} } = req.body;
    const lang = req.language || 'en';
    
    const startTime = Date.now();
    
    // Determine stage
    const calculatedStage = determineStage(extracted, answers);
    const userStage = answers.stage || calculatedStage;
    
    // Get treatment packages
    const packages = computePackages(userStage, extracted);
    
    // Get PDF link
    const pdfUrl = getPdfLink(userStage, extracted);
    
    // Generate AI summary
    const summary = await geminiService.generateSummary(userStage, answers, packages, lang);
    
    // Prepare result data
    const resultData = {
      userStage,
      calculatedStage,
      packages,
      pdfUrl,
      summary,
      processingTime: Date.now() - startTime,
      filesUploaded: extracted.filesProcessed || 0
    };
    
    // Save to BigQuery
    const saveResult = await bigqueryService.insertSurveyResponse({
      answers,
      extracted,
      ...resultData,
      language: lang
    });
    
    // Send email if email provided
    if (answers.email) {
      try {
        await emailService.sendSurveyConfirmation(answers.email, answers, resultData, lang);
      } catch (emailError) {
        logger.error('Error sending email:', emailError);
        // Don't fail the entire request if email fails
      }
    }
    
    res.json({
      success: true,
      ...resultData,
      surveyId: saveResult.surveyId
    });
    
  } catch (error) {
    logger.error('Error submitting survey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit survey'
    });
  }
});

// Get survey by ID
router.get('/survey/:surveyId', async (req, res) => {
  try {
    const { surveyId } = req.params;
    const survey = await bigqueryService.getSurveyById(surveyId);
    
    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }
    
    res.json({
      success: true,
      survey
    });
  } catch (error) {
    logger.error('Error getting survey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get survey'
    });
  }
});

// Get analytics
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await bigqueryService.getSurveyAnalytics();
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

// Helper functions
function getSurveyQuestions(stage, lang = 'en') {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1980; y--) years.push(y);
  
  const questions = [
    { 
      id: 'gender', 
      type: 'radio', 
      title: lang === 'fr' ? 'Quel est votre sexe désigné à la naissance?' : 'What is your gender designated at birth?', 
      required: true,
      options: lang === 'fr' ? ['Homme', 'Femme'] : ['Male', 'Female'] 
    },
    { 
      id: 'year', 
      type: 'select', 
      title: lang === 'fr' ? 'Année de diagnostic' : 'Year of diagnosis', 
      required: true,
      options: years 
    },
    { 
      id: 'lymphNodes', 
      type: 'select', 
      title: lang === 'fr' ? 'Nombre de ganglions lymphatiques positifs au diagnostic?' : '# of positive lymph nodes at diagnosis?', 
      required: true,
      options: lang === 'fr' ? ['0 (aucun)', '1', '2', '3', '4+'] : ['0 (none)', '1', '2', '3', '4+']
    },
    { 
      id: 'laterality', 
      type: 'select', 
      title: lang === 'fr' ? 'Quel sein a été diagnostiqué?' : 'Which breast was diagnosed?', 
      required: true,
      options: lang === 'fr' ? ['Gauche', 'Droite', 'Les deux'] : ['Left', 'Right', 'Both']
    },
    { 
      id: 'denseBreasts', 
      type: 'radio', 
      title: lang === 'fr' ? 'Décrit comme ayant des \'seins denses\'?' : 'Described as \'dense breasts\'?', 
      required: true,
      options: lang === 'fr' ? ['Oui', 'Non'] : ['Yes', 'No'] 
    },
    { 
      id: 'ERPR', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut hormonal/endocrinien (ER & PR)?' : 'Hormonal/endocrine status (ER & PR)?', 
      required: true,
      options: lang === 'fr' 
        ? ['ER+ & PR+', 'ER+ & PR–', 'ER– & PR+', 'ER– & PR–', 'Pas sûr'] 
        : ['ER+ & PR+', 'ER+ & PR–', 'ER– & PR+', 'ER– & PR–', 'Not sure']
    },
    { 
      id: 'HER2', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut du biomarqueur HER-2?' : 'HER-2 biomarker status?', 
      required: true,
      options: lang === 'fr' 
        ? ['HER-2 Élevé (3+)', 'HER-2 Faible (1+ ou 2+)', 'HER-2 Négatif (0)', 'Pas sûr'] 
        : ['HER-2 High (3+)', 'HER-2 Low (1+ or 2+)', 'HER-2 Negative (0)', 'Not sure']
    },
    { 
      id: 'luminal', 
      type: 'select', 
      title: lang === 'fr' ? 'Sous-type luminal?' : 'Luminal subtype?', 
      required: true,
      options: lang === 'fr' ? ['Luminal A', 'Luminal B', 'Pas sûr'] : ['Luminal A', 'Luminal B', 'Not sure']
    },
    { 
      id: 'BRCA', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut BRCA1 / BRCA2?' : 'BRCA1 / BRCA2 status?', 
      required: true,
      options: lang === 'fr' 
        ? ['Non testé', 'BRCA1+', 'BRCA2+', 'Les deux', 'Pas sûr'] 
        : ['Not tested', 'BRCA1+', 'BRCA2+', 'Both', 'Not sure']
    },
    { 
      id: 'PIK3CA', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut PIK3CA?' : 'PIK3CA status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'Positif', 'Négatif', 'Pas sûr'] : ['Not tested', 'Positive', 'Negative', 'Not sure']
    },
    { 
      id: 'ESR1', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut ESR1?' : 'ESR1 status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'Positif', 'Négatif', 'Pas sûr'] : ['Not tested', 'Positive', 'Negative', 'Not sure']
    },
    { 
      id: 'PDL1', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut PD-L1?' : 'PD-L1 status?', 
      required: true,
      options: lang === 'fr' 
        ? ['Non testé', 'Expression élevée', 'Expression faible', 'Pas sûr'] 
        : ['Not tested', 'High expression', 'Low expression', 'Not sure']
    },
    { 
      id: 'MSI', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut MSI?' : 'MSI status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'MSI-Élevé', 'MSI-Faible', 'Pas sûr'] : ['Not tested', 'MSI-High', 'MSI-Low', 'Not sure']
    },
    { 
      id: 'Ki67', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut Ki-67?' : 'Ki-67 status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'Faible (<20%)', 'Élevé (≥20%)', 'Pas sûr'] : ['Not tested', 'Low (<20%)', 'High (≥20%)', 'Not sure']
    },
    { 
      id: 'PTEN', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut PTEN?' : 'PTEN status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'Positif', 'Négatif', 'Pas sûr'] : ['Not tested', 'Positive', 'Negative', 'Not sure']
    },
    { 
      id: 'AKT1', 
      type: 'select', 
      title: lang === 'fr' ? 'Statut AKT1?' : 'AKT1 status?', 
      required: true,
      options: lang === 'fr' ? ['Non testé', 'Mutation détectée', 'Pas sûr'] : ['Not tested', 'Mutation detected', 'Not sure']
    }
  ];
  
  // Add Stage IV specific questions if needed
  if (stage && stage.includes('IV')) {
    questions.push({ 
      id: 'spread', 
      type: 'checkbox', 
      title: lang === 'fr' ? 'Si stade IV : où s\'est-il propagé? (Optionnel)' : 'If Stage IV: where has it spread? (Optional)', 
      required: false,
      options: lang === 'fr' ? ['Os', 'Foie', 'Poumon(s)', 'Cerveau', 'Œil', 'Autre'] : ['Bone', 'Liver', 'Lung(s)', 'Brain', 'Eye', 'Other']
    });
  }
  
  return questions;
}

function determineStage(extracted, answers) {
  if (extracted.stage && extracted.stage !== 'Not available') {
    return extracted.stage;
  }
  
  const erPos = extracted.ERPR && extracted.ERPR.includes('ER+');
  const prPos = extracted.ERPR && extracted.ERPR.includes('PR+');
  const her2High = extracted.HER2 && extracted.HER2.includes('(3+)');
  const her2Low = extracted.HER2 && extracted.HER2.includes('(1+ or 2+)');
  const brcaPos = extracted.BRCA && (extracted.BRCA.includes('BRCA1+') || extracted.BRCA.includes('BRCA2+'));
  
  // Advanced stage calculation based on biomarkers
  if (erPos && her2High) return 'Stage II ER+/PR+/HER2+';
  if (erPos && her2Low) return 'Stage II ER+/PR+/HER2 Low';
  if (erPos && !her2High && !her2Low) return 'Stage II ER+/PR+';
  if (brcaPos) return 'Stage II BRCA+';
  if (her2High) return 'Stage II HER-2+';
  if (!erPos && !prPos && !her2High) return 'Stage II TNBC';
  
  return 'Stage II';
}

function computePackages(userStage, extracted) {
  const packages = [];
  
  if (userStage.includes('Stage IV')) {
    if (userStage.includes('ER+/PR+') && userStage.includes('HER2+')) {
      packages.push('Stage IV ER/PR+/HER2+ package');
    }
    else if (userStage.includes('ER+/PR+') && !userStage.includes('HER2+')) {
      packages.push('Stage IV ER/PR+ package');
    } 
    else if (userStage.includes('HER-2+') && !userStage.includes('ER+/PR+')) {
      packages.push('Stage IV HER-2+ package');
    } 
    else if (extracted.BRCA && (extracted.BRCA.includes('BRCA1+') || extracted.BRCA.includes('BRCA2+'))) {
      packages.push('Stage IV BRCA+ package');
    } 
    else {
      packages.push('Core package for Stage IV');
    }
  } 
  else if (userStage.includes('Stage III')) {
    if (userStage.includes('BRCA+')) {
      packages.push('Stage III BRCA+ package');
    } 
    else if (userStage.includes('ER+/PR+/HER2+')) {
      packages.push('Stage III ER/PR+/HER2+ package');
    } 
    else if (userStage.includes('HER-2+')) {
      packages.push('Stage III HER-2+ package');
    } 
    else if (userStage.includes('ER+/PR+')) {
      packages.push('Stage III ER/PR+ package');
    }
    else if (userStage.includes('ER+/PR+/HER2 Low')) {
      packages.push('Stage III ER/PR+/HER2 Low package');
    }
    else {
      packages.push('Core package for Stage III (TNBC)');
    }
  } 
  else if (userStage.includes('Stage II')) {
    if (userStage.includes('BRCA+')) {
      packages.push('Stage II BRCA+ package');
    } 
    else if (userStage.includes('ER+/PR+/HER2+')) {
      packages.push('Stage II ER/PR+/HER2+ package');
    } 
    else if (userStage.includes('HER-2+')) {
      packages.push('Stage II HER-2+ package');
    } 
    else if (userStage.includes('ER+/PR+')) {
      packages.push('Stage II ER/PR+ package');
    }
    else if (userStage.includes('ER+/PR+/HER2 Low')) {
      packages.push('Stage II ER/PR+/HER2 Low package');
    }
    else {
      packages.push('Core package for Stage II (TNBC)');
    }
  } 
  else if (userStage.includes('Stage I')) {
    packages.push('Core package for Stage I');
  } 
  else if (userStage.includes('Stage 0') || userStage.includes('DCIS')) {
    packages.push('Core package for DCIS / Stage 0');
  }
  
  // Add targeted therapies based on biomarkers
  if (extracted.BRCA && extracted.BRCA.includes('+')) {
    packages.push('PARP inhibitors');
  }
  if (extracted.HER2 && extracted.HER2.includes('(3+)')) {
    packages.push('HER2-targeted therapy');
  }
  if (extracted.PIK3CA && /Positive/i.test(extracted.PIK3CA)) {
    packages.push('PIK3CA-Targeted Therapy');
  }
  if (extracted.ESR1 && /Positive/i.test(extracted.ESR1)) {
    packages.push('ESR1-Targeted Therapy');
  }
  
  return packages;
}

function getPdfLink(userStage, extracted) {
  try {
    // Define fallback mapping
    const fallbackMap = {
      'DCIS / Stage 0': 'https://drive.google.com/file/d/1SNem7t-VJf-q31D-NuJJHNY08Jdf1k_z/view?usp=drive_link',
      'Stage I': 'https://drive.google.com/file/d/1v45G7eO1PfleAo10eY5GfZ8NVqJmVor_/view?usp=drive_link',
      'Stage II': 'https://drive.google.com/file/d/1sv8_QGiwmLTVpU8u1HyXmHFPV0HBVqsV/view?usp=drive_link',
      'Stage III': 'https://drive.google.com/file/d/10JZ1MVfukIphQovbhEEZ1eGCNNBTEWb7/view?usp=drive_link',
      'Stage IV': 'https://drive.google.com/file/d/1i6I7SRjobdZScTj2-tAFLQwBOsAImSez/view?usp=drive_link'
    };
    
    return fallbackMap[userStage] || fallbackMap['Stage II'];
  } catch (e) {
    logger.error('Error getting PDF link:', e);
    return '';
  }
}

module.exports = router;