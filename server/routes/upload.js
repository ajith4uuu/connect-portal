const express = require('express');
const multer = require('multer');
const DocumentAIService = require('../services/documentAI');
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
    new winston.transports.File({ filename: 'upload.log' })
  ]
});

const documentAIService = new DocumentAIService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, JPG, PNG files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
    }
  }
});

// Upload and analyze files
router.post('/analyze', upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    const { lang = 'en' } = req.query;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    logger.info(`Processing ${files.length} files for analysis`);
    
    // Process files with Document AI
    const analysisResults = await documentAIService.processMultipleFiles(files);
    
    // Calculate stage from biomarkers if not detected
    if (!analysisResults.stage) {
      analysisResults.stage = calculateStageFromBiomarkers(analysisResults, lang);
    }
    
    res.json({
      success: true,
      extracted: analysisResults,
      filesProcessed: analysisResults.filesProcessed,
      message: `Successfully processed ${analysisResults.filesProcessed} out of ${files.length} files`
    });
    
  } catch (error) {
    logger.error('Error analyzing files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze files'
    });
  }
});

// Upload files to GCS (for later processing)
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    const uploadedFiles = [];
    
    for (const file of files) {
      try {
        const gcsUri = await documentAIService.uploadToGCS(file, file.originalname);
        uploadedFiles.push({
          filename: file.originalname,
          gcsUri: gcsUri,
          size: file.size,
          mimetype: file.mimetype
        });
      } catch (error) {
        logger.error(`Error uploading file ${file.originalname}:`, error);
        // Continue with other files
      }
    }
    
    res.json({
      success: true,
      uploadedFiles,
      count: uploadedFiles.length
    });
    
  } catch (error) {
    logger.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload files'
    });
  }
});

// Process files from GCS
router.post('/process-gcs', async (req, res) => {
  try {
    const { gcsUris, lang = 'en' } = req.body;
    
    if (!gcsUris || !Array.isArray(gcsUris) || gcsUris.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No GCS URIs provided'
      });
    }
    
    const results = {
      province: '',
      age: '',
      stage: '',
      ERPR: '',
      HER2: '',
      BRCA: '',
      luminal: '',
      PIK3CA: '',
      ESR1: '',
      PDL1: '',
      MSI: '',
      Ki67: '',
      PTEN: '',
      AKT1: ''
    };
    
    let filesProcessed = 0;
    
    for (const gcsUri of gcsUris) {
      try {
        logger.info(`Processing GCS file: ${gcsUri}`);
        
        const document = await documentAIService.processDocument(gcsUri);
        const fileData = documentAIService.extractDataFromDocument(document);
        
        // Merge results
        for (const key in fileData) {
          if (fileData[key] && fileData[key] !== null) {
            results[key] = fileData[key];
          }
        }
        
        filesProcessed++;
        
      } catch (error) {
        logger.error(`Error processing GCS file ${gcsUri}:`, error);
        // Continue with other files
      }
    }
    
    // Calculate stage from biomarkers if not detected
    if (!results.stage) {
      results.stage = calculateStageFromBiomarkers(results, lang);
    }
    
    res.json({
      success: true,
      extracted: { ...results, filesProcessed },
      filesProcessed,
      message: `Successfully processed ${filesProcessed} out of ${gcsUris.length} files`
    });
    
  } catch (error) {
    logger.error('Error processing GCS files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process GCS files'
    });
  }
});

// Helper function to calculate stage from biomarkers
function calculateStageFromBiomarkers(extracted, lang) {
  const translations = {
    en: {
      calculating: 'Calculating stage from biomarkers...',
      calculated: 'Stage calculated from biomarkers'
    },
    fr: {
      calculating: 'Calcul du stade à partir des biomarqueurs...',
      calculated: 'Stade calculé à partir des biomarqueurs'
    }
  };
  
  const t = translations[lang] || translations.en;
  
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

module.exports = router;