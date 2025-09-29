const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');
const nodemailer = require('nodemailer');
const { VertexAI } = require('@google-cloud/aiplatform');

const translations = require('./translations');
const { extractDataFromText, calculateStageFromBiomarkers, computePackages, getPdfLink } = require('./utils');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Google Cloud clients
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID
});
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID
});
const documentAI = new DocumentProcessorServiceClient();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // max 10 files
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Initialize BigQuery schema
async function initializeBigQuery() {
  const datasetId = process.env.BQ_DATASET_ID || 'bcc_portal';
  const tableId = process.env.BQ_TABLE_ID || 'survey_responses';
  
  try {
    // Create dataset if it doesn't exist
    const [datasets] = await bigquery.getDatasets();
    const datasetExists = datasets.some(d => d.id === datasetId);
    
    if (!datasetExists) {
      await bigquery.createDataset(datasetId, {
        location: 'US'
      });
      console.log(`Dataset ${datasetId} created.`);
    }
    
    // Create table with schema if it doesn't exist
    const dataset = bigquery.dataset(datasetId);
    const [tables] = await dataset.getTables();
    const tableExists = tables.some(t => t.id === tableId);
    
    if (!tableExists) {
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'language', type: 'STRING', mode: 'NULLABLE' },
        { name: 'email', type: 'STRING', mode: 'NULLABLE' },
        { name: 'age', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'gender', type: 'STRING', mode: 'NULLABLE' },
        { name: 'country', type: 'STRING', mode: 'NULLABLE' },
        { name: 'province', type: 'STRING', mode: 'NULLABLE' },
        { name: 'year_diagnosis', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'selected_stage', type: 'STRING', mode: 'NULLABLE' },
        { name: 'calculated_stage', type: 'STRING', mode: 'NULLABLE' },
        { name: 'lymph_nodes', type: 'STRING', mode: 'NULLABLE' },
        { name: 'laterality', type: 'STRING', mode: 'NULLABLE' },
        { name: 'dense_breasts', type: 'STRING', mode: 'NULLABLE' },
        { name: 'erpr_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'her2_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'luminal_subtype', type: 'STRING', mode: 'NULLABLE' },
        { name: 'brca_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'pik3ca_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'esr1_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'pdl1_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'msi_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ki67_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'pten_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'akt1_status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'spread_locations', type: 'STRING', mode: 'REPEATED' },
        { name: 'treatment_packages', type: 'STRING', mode: 'REPEATED' },
        { name: 'pdf_url', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ai_summary', type: 'STRING', mode: 'NULLABLE' },
        { name: 'extracted_data', type: 'JSON', mode: 'NULLABLE' },
        { name: 'raw_responses', type: 'JSON', mode: 'NULLABLE' }
      ];
      
      await dataset.createTable(tableId, { schema });
      console.log(`Table ${tableId} created with schema.`);
    }
  } catch (error) {
    console.error('Error initializing BigQuery:', error);
  }
}

// Initialize BigQuery on startup
initializeBigQuery();

// API Routes

// Get translations
app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang || 'en';
  res.json(translations[lang] || translations.en);
});

// Get survey definition
app.get('/api/survey/:lang', (req, res) => {
  const lang = req.params.lang || 'en';
  const t = translations[lang] || translations.en;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1980; y--) years.push(y);
  
  const surveyDef = [
    { 
      id: 'gender', 
      type: 'radio', 
      title: t.gender_title, 
      required: true,
      options: [t.male, t.female] 
    },
    { 
      id: 'year', 
      type: 'select', 
      title: t.year_title, 
      required: true,
      options: years 
    },
    { 
      id: 'lymphNodes', 
      type: 'select', 
      title: t.lymphNodes_title, 
      required: true,
      options: t.lymphNodes_options
    },
    { 
      id: 'laterality', 
      type: 'select', 
      title: t.laterality_title, 
      required: true,
      options: t.laterality_options
    },
    { 
      id: 'denseBreasts', 
      type: 'radio', 
      title: t.denseBreasts_title, 
      required: true,
      options: [t.yes, t.no] 
    },
    { 
      id: 'ERPR', 
      type: 'select', 
      title: t.ERPR_title, 
      required: true,
      options: t.ERPR_options
    },
    { 
      id: 'HER2', 
      type: 'select', 
      title: t.HER2_title, 
      required: true,
      options: t.HER2_options
    },
    { 
      id: 'luminal', 
      type: 'select', 
      title: t.luminal_title, 
      required: true,
      options: t.luminal_options
    },
    { 
      id: 'BRCA', 
      type: 'select', 
      title: t.BRCA_title, 
      required: true,
      options: t.BRCA_options
    },
    { 
      id: 'PIK3CA', 
      type: 'select', 
      title: t.PIK3CA_title, 
      required: true,
      options: t.PIK3CA_options
    },
    { 
      id: 'ESR1', 
      type: 'select', 
      title: t.ESR1_title, 
      required: true,
      options: t.ESR1_options
    },
    { 
      id: 'PDL1', 
      type: 'select', 
      title: t.PDL1_title, 
      required: true,
      options: t.PDL1_options
    },
    { 
      id: 'MSI', 
      type: 'select', 
      title: t.MSI_title, 
      required: true,
      options: t.MSI_options
    },
    { 
      id: 'Ki67', 
      type: 'select', 
      title: t.Ki67_title, 
      required: true,
      options: t.Ki67_options
    },
    { 
      id: 'PTEN', 
      type: 'select', 
      title: t.PTEN_title, 
      required: true,
      options: t.PTEN_options
    },
    { 
      id: 'AKT1', 
      type: 'select', 
      title: t.AKT1_title, 
      required: true,
      options: t.AKT1_options
    },
    { 
      id: 'spread', 
      type: 'checkbox', 
      title: t.spread_title, 
      required: false,
      options: t.spread_options
    }
  ];
  
  res.json(surveyDef);
});

// Process PDF upload with Document AI
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  const { lang = 'en' } = req.body;
  const t = translations[lang] || translations.en;
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: t.no_files_uploaded });
    }
    
    const bucketName = process.env.GCS_BUCKET || 'bcc-documentai-pdfs';
    const bucket = storage.bucket(bucketName);
    
    let combinedData = {
      province: '',
      age: '',
      stage: '',
      ERPR: '',
      HER2: '',
      luminal: '',
      BRCA: '',
      PIK3CA: '',
      ESR1: '',
      PDL1: '',
      MSI: '',
      Ki67: '',
      PTEN: '',
      AKT1: ''
    };
    
    // Process each file
    for (const file of req.files) {
      const fileName = `reports/${Date.now()}_${file.originalname}`;
      const blob = bucket.file(fileName);
      
      // Upload to GCS
      await blob.save(file.buffer, {
        metadata: { contentType: file.mimetype }
      });
      
      // Process with Document AI
      const projectId = process.env.GCP_PROJECT_ID;
      const location = process.env.DOCAI_LOCATION || 'us';
      const processorId = process.env.DOCAI_PROCESSOR_ID;
      
      const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
      
      const request = {
        name,
        rawDocument: {
          content: file.buffer.toString('base64'),
          mimeType: file.mimetype
        }
      };
      
      try {
        const [result] = await documentAI.processDocument(request);
        const { document } = result;
        const text = document.text;
        
        // Extract data from text
        const fileData = extractDataFromText(text);
        
        // Merge with combined data
        for (const key in fileData) {
          if (fileData[key] && fileData[key] !== t.not_available) {
            combinedData[key] = fileData[key];
          }
        }
      } catch (docError) {
        console.error('Document AI processing error:', docError);
      }
    }
    
    // Calculate stage if not detected
    if (!combinedData.stage || combinedData.stage === t.not_available) {
      combinedData.stage = calculateStageFromBiomarkers(combinedData);
    }
    
    res.json({ success: true, data: combinedData });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: t.upload_error });
  }
});

// Submit survey
app.post('/api/submit', async (req, res) => {
  const { extracted, answers, lang = 'en' } = req.body;
  const t = translations[lang] || translations.en;
  
  try {
    // Generate unique ID
    const responseId = uuidv4();
    
    // Determine stages
    const calculatedStage = calculateStageFromBiomarkers(extracted);
    const userStage = answers.stage || calculatedStage;
    
    // Get treatment packages
    const packages = computePackages(userStage, extracted);
    
    // Get PDF link
    const pdfUrl = getPdfLink(userStage, extracted);
    
    // Generate AI summary
    let aiSummary = '';
    if (process.env.GEMINI_API_KEY) {
      aiSummary = await generateGeminiSummary(userStage, answers, packages, lang);
    }
    
    // Save to BigQuery
    const datasetId = process.env.BQ_DATASET_ID || 'bcc_portal';
    const tableId = process.env.BQ_TABLE_ID || 'survey_responses';
    
    const row = {
      id: responseId,
      timestamp: new Date().toISOString(),
      language: lang,
      email: answers.email || null,
      age: parseInt(answers.age) || null,
      gender: answers.gender || null,
      country: answers.country || null,
      province: answers.province || null,
      year_diagnosis: parseInt(answers.year) || null,
      selected_stage: userStage,
      calculated_stage: calculatedStage,
      lymph_nodes: answers.lymphNodes || null,
      laterality: answers.laterality || null,
      dense_breasts: answers.denseBreasts || null,
      erpr_status: answers.ERPR || null,
      her2_status: answers.HER2 || null,
      luminal_subtype: answers.luminal || null,
      brca_status: answers.BRCA || null,
      pik3ca_status: answers.PIK3CA || null,
      esr1_status: answers.ESR1 || null,
      pdl1_status: answers.PDL1 || null,
      msi_status: answers.MSI || null,
      ki67_status: answers.Ki67 || null,
      pten_status: answers.PTEN || null,
      akt1_status: answers.AKT1 || null,
      spread_locations: Array.isArray(answers.spread) ? answers.spread : [],
      treatment_packages: packages,
      pdf_url: pdfUrl || null,
      ai_summary: aiSummary || null,
      extracted_data: JSON.stringify(extracted),
      raw_responses: JSON.stringify(answers)
    };
    
    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert([row]);
    
    // Send email if provided
    if (answers.email) {
      await sendEmail(answers.email, userStage, calculatedStage, packages, pdfUrl, aiSummary, lang);
    }
    
    res.json({
      success: true,
      data: {
        responseId,
        userStage,
        calculatedStage,
        packages: packages.join('; '),
        downloadUrl: pdfUrl,
        geminiSummary: aiSummary
      }
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: t.submission_failed });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Gemini summary generation
async function generateGeminiSummary(userStage, answers, packages, lang = 'en') {
  const t = translations[lang] || translations.en;
  const langName = lang === 'fr' ? 'French' : 'English';
  
  if (!process.env.GEMINI_API_KEY) {
    return t.summary_text + '\n\n' + packages.join(', ');
  }
  
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    
    const pathologyData = `
${t.gender_title}: ${answers.gender || t.not_specified}
${t.age_label}: ${answers.age || t.not_specified}
${t.country_label}: ${answers.country || t.not_specified}
${t.province_label}: ${answers.province || t.not_specified}

${t.selected_stage}: ${userStage || t.not_specified}
${t.year_title}: ${answers.year || t.unknown}
${t.lymphNodes_title}: ${answers.lymphNodes || t.not_specified}
${t.laterality_title}: ${answers.laterality || t.not_specified}
${t.denseBreasts_title}: ${answers.denseBreasts || t.not_specified}

${t.ERPR_title}: ${answers.ERPR || t.not_tested}
${t.HER2_title}: ${answers.HER2 || t.not_tested}
${t.BRCA_title}: ${answers.BRCA || t.not_tested}
${t.PIK3CA_title}: ${answers.PIK3CA || t.not_tested}
${answers.spread ? `${t.spread_title}: ${Array.isArray(answers.spread) ? answers.spread.join(', ') : answers.spread || ''}` : ''}`;
    
    const prompt = `${t.summary_text}\n\n${t.bcc_package} ${packages.join(', ')}\n\n` +
                  `Please generate a comprehensive patient summary in ${langName} using this data:\n\n` +
                  pathologyData;
    
    const response = await fetch(`${url}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2000
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    }
    
    return t.summary_text + '\n\n' + packages.join(', ');
  } catch (error) {
    console.error('Gemini API error:', error);
    return t.summary_text + '\n\n' + packages.join(', ');
  }
}

// Send email function
async function sendEmail(email, userStage, calculatedStage, packages, pdfUrl, summary, lang = 'en') {
  const t = translations[lang] || translations.en;
  
  try {
    const subject = `${t.email_subject} - ${userStage}`;
    const body = `${t.hello}\n\n` +
                 `${t.submission_received}\n\n` +
                 `${t.selected_stage} ${userStage}\n` +
                 `${t.calculated_stage} ${calculatedStage}\n` +
                 `${t.bcc_package} ${packages.join(', ')}\n\n` +
                 `${pdfUrl ? `${t.download_btn}: ${pdfUrl}\n\n` : ''}` +
                 `${t.ai_summary}:\n${summary || t.no_summary}\n\n` +
                 `${t.important_note}\n${t.consult_doctor}\n\n` +
                 `${t.best_regards}\n${t.team_name}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: body
    });
    
    console.log('Email sent successfully to:', email);
  } catch (error) {
    console.error('Email error:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
