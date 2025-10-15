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
const { extractDataFromText, calculateStageFromBiomarkers, computePackages, getPdfLink, getPdfKey, parseReportDate, detectReportType } = require('./utils');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Google Cloud clients (use Application Default Credentials on Cloud Run)
const bigquery = new BigQuery();
const storage = new Storage();
const documentAI = new DocumentProcessorServiceClient();

// Trust proxy (required for accurate client IPs behind proxy)
app.set('trust proxy', 1);

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

// In-memory OTP store fallback (for local/dev)
const otpStore = new Map();

// Resolve GCP project ID when running on Cloud Run (ADC) or locally
let __cachedProjectId = null;
async function getProjectIdSafe() {
  if (__cachedProjectId) return __cachedProjectId;
  try {
    __cachedProjectId = await bigquery.getProjectId();
    return __cachedProjectId;
  } catch (e) {
    return process.env.GCP_PROJECT_ID || '';
  }
}

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

    // Ensure OTP table exists
    const [tablesOtp] = await dataset.getTables();
    const otpExists = tablesOtp.some(t => t.id === 'otp_codes');
    if (!otpExists) {
      const otpSchema = [
        { name: 'email', type: 'STRING', mode: 'REQUIRED' },
        { name: 'code', type: 'STRING', mode: 'REQUIRED' },
        { name: 'expires_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'used', type: 'BOOL', mode: 'REQUIRED' },
        { name: 'attempts', type: 'INTEGER', mode: 'REQUIRED' }
      ];
      await dataset.createTable('otp_codes', { schema: otpSchema });
      console.log('Table otp_codes created with schema.');
    }
  } catch (error) {
    console.error('Error initializing BigQuery:', error);
  }
}

// Initialize BigQuery on startup (let ADC provide credentials on Cloud Run)
if (process.env.BQ_DISABLE_INIT === 'true' || (!process.env.GCP_PROJECT_ID && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  console.warn('BigQuery initialization skipped: no credentials configured.');
} else {
  initializeBigQuery();
}

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
    const fieldTimestamps = {};

    const projectId = await getProjectIdSafe();
    const hasDocAi = !!process.env.DOCAI_PROCESSOR_ID && !!projectId;
    if (!hasDocAi) {
      console.warn('Document AI disabled: missing processor or project id.');
      return res.json({ success: true, data: combinedData });
    }

    // Process each file
    let processedCount = 0;
    for (const file of req.files) {
      const fileName = `reports/${Date.now()}_${file.originalname}`;
      const blob = bucket.file(fileName);

      // Upload to GCS
      await blob.save(file.buffer, {
        metadata: { contentType: file.mimetype }
      });

      // Process with Document AI
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
        const text = document.text || '';

        // Extract data from text
        const fileDataRaw = extractDataFromText(text);
        const reportType = detectReportType(text);
        const fileDate = parseReportDate(text) || new Date();

        // Whitelist fields per report type: genetics only contributes BRCA; pathology contributes demographics and biomarkers (excluding BRCA)
        const GENETIC_FIELDS = ['BRCA'];
        const PATHOLOGY_FIELDS = ['province','age','country','stage','ERPR','HER2','luminal','PIK3CA','ESR1','PDL1','MSI','Ki67','PTEN','AKT1'];
        const allowed = reportType === 'genetic' ? GENETIC_FIELDS : PATHOLOGY_FIELDS;
        const fileData = Object.fromEntries(Object.entries(fileDataRaw).filter(([k]) => allowed.includes(k)));

        // Merge with combined data, preferring meaningful and latest per-field
        for (const key in fileData) {
          const val = fileData[key];
          const isMeaningful = (v) => {
            if (!v) return false;
            const s = String(v).toLowerCase();
            return s !== String(t.not_available).toLowerCase() &&
                   !s.includes('not tested') &&
                   !s.includes('not sure') &&
                   !s.includes('not specified') &&
                   !s.includes('unknown');
          };
          const prev = combinedData[key];
          const prevMeaningful = isMeaningful(prev);
          const currMeaningful = isMeaningful(val);
          if (currMeaningful && (!prevMeaningful || fileDate >= (fieldTimestamps[key] || 0))) {
            combinedData[key] = val;
            fieldTimestamps[key] = fileDate;
          } else if (!prevMeaningful && (val && val !== t.not_available)) {
            // allow filling previously empty with any value
            combinedData[key] = val;
            fieldTimestamps[key] = fileDate;
          }
        }
        processedCount += 1;
      } catch (docError) {
        console.error('Document AI processing error:', docError);
      }
    }
    
    // Calculate stage if not detected
    if (!combinedData.stage || combinedData.stage === t.not_available) {
      combinedData.stage = calculateStageFromBiomarkers(combinedData);
    }

    // Default missing biomarkers to "Not tested"
    const biomarkerKeys = ['ERPR','HER2','luminal','BRCA','PIK3CA','ESR1','PDL1','MSI','Ki67','PTEN','AKT1'];
    for (const k of biomarkerKeys) {
      if (!combinedData[k] || String(combinedData[k]).trim() === '') {
        combinedData[k] = t.not_tested;
      }
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
    
    // Get PDF link (prefer GCS if configured)
    const pdfUrl = await resolvePdfUrl(userStage, extracted);

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
    
    try {
      await bigquery
        .dataset(datasetId)
        .table(tableId)
        .insert([row]);
    } catch (e) {
      console.warn('BigQuery insert skipped:', e.message || e);
    }
    
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

// OTP: send code
app.post('/api/otp/send', async (req, res) => {
  if (process.env.OTP_ENABLED === 'false') {
    return res.status(501).json({ error: 'OTP disabled' });
  }
  try {
    const rawEmail = (req.body && req.body.email) ? String(req.body.email) : '';
    const email = rawEmail.trim().toLowerCase();
    const { lang = 'en' } = req.body || {};
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Always store in memory to guarantee fallback on environments without BigQuery or multi-instance timing issues
    otpStore.set(email, { code, expiresAt, attempts: 0, used: false });

    try {
      const datasetId = process.env.BQ_DATASET_ID || 'bcc_portal';
      const otpRow = {
        email,
        code,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        used: false,
        attempts: 0
      };
      await bigquery.dataset(datasetId).table('otp_codes').insert([otpRow]);
    } catch (e) {
      // ignore; memory fallback already set
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your one time access code (OTP)',
        text: `Please use this as your one time access code (OTP) to enter your account on Progress Connect Registry that is linked to your email address.\n\nOTP: ${code}\nThis code expires in 10 minutes.`
      });
      return res.json({ success: true });
    } catch (mailErr) {
      console.error('OTP email send error:', mailErr);
      if (process.env.OTP_DEBUG === 'true') {
        return res.json({ success: true, debugCode: code });
      }
      return res.status(500).json({ error: 'Email delivery failed' });
    }
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// OTP: verify code
app.post('/api/otp/verify', async (req, res) => {
  if (process.env.OTP_ENABLED === 'false') {
    return res.status(501).json({ error: 'OTP disabled' });
  }
  try {
    const rawEmail = (req.body && req.body.email) ? String(req.body.email) : '';
    const rawCode = (req.body && req.body.code) ? String(req.body.code) : '';
    const email = rawEmail.trim().toLowerCase();
    const code = rawCode.replace(/\s+/g, '');
    if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });

    let bgReason = '';
    try {
      const datasetId = process.env.BQ_DATASET_ID || 'bcc_portal';
      const projectId = await getProjectIdSafe();
      if (projectId) {
        const tableFqn = `\`${projectId}.${datasetId}.otp_codes\``;
        const query = {
          query: `SELECT email, code, expires_at, used FROM ${tableFqn} WHERE email=@email ORDER BY created_at DESC LIMIT 1`,
          params: { email }
        };
        const [rows] = await bigquery.query(query);
        const match = rows && rows[0] ? rows[0] : null;
        if (match) {
          if (new Date(match.expires_at) < new Date()) {
            bgReason = 'Code expired';
          } else if (match.used) {
            bgReason = 'Code already used';
          } else if (String(match.code) === code) {
            await bigquery.query({
              query: `UPDATE ${tableFqn} SET used=true WHERE email=@email AND code=@code`,
              params: { email, code }
            });
            return res.json({ success: true });
          } else {
            bgReason = 'Invalid code';
          }
        }
      }
    } catch (e) {
      // ignore and fall back to memory store
    }

    const rec = otpStore.get(email);
    if (rec && !rec.used && rec.expiresAt >= new Date() && String(rec.code) === code) {
      rec.used = true;
      otpStore.set(email, rec);
      return res.json({ success: true });
    }

    // If we reach here, both BigQuery and memory verification failed
    const errorMsg = bgReason || (rec ? (rec.used ? 'Code already used' : (rec.expiresAt < new Date() ? 'Code expired' : 'Invalid code')) : 'No code found');
    return res.status(400).json({ error: errorMsg });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// PDF key -> GCS object name
function pdfKeyToObjectName(key) {
  if (!key) return '';
  const normalized = key
    .toLowerCase()
    .replace(/dcis\s*\/\s*stage\s*0/g, 'dcis-stage-0')
    .replace(/stage\s*iv\b/g, 'stage-iv')
    .replace(/stage\s*iii\b/g, 'stage-iii')
    .replace(/stage\s*ii\b/g, 'stage-ii')
    .replace(/stage\s*i\b/g, 'stage-i')
    .replace(/stage\s*0\b/g, 'stage-0')
    .replace(/er\+\s*\/\s*pr\+/g, 'erprplus')
    .replace(/er\s*\/\s*pr\+/g, 'erprplus')
    .replace(/er\+\s*\/\s*pr\s*\+/g, 'erprplus')
    .replace(/her[-\s]?2\s*\+/g, 'her2plus')
    .replace(/her[-\s]?2\s*low/g, 'her2-low')
    .replace(/brca\s*\+/g, 'brca-plus')
    .replace(/\s*\+\s*/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${normalized}.pdf`;
}

function buildGcsPublicUrl(bucket, objectPath) {
  return `https://storage.googleapis.com/${bucket}/${objectPath}`;
}

async function fileExistsInGcs(bucketName, objectPath) {
  try {
    const [exists] = await storage.bucket(bucketName).file(objectPath).exists();
    return !!exists;
  } catch (_) {
    return false;
  }
}

async function resolvePdfUrl(userStage, extracted) {
  const bucketName = process.env.GCS_PDF_BUCKET;
  if (!bucketName) {
    return getPdfLink(userStage, extracted) || '';
  }

  const prefix = (process.env.GCS_PDF_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const access = (process.env.GCS_PDF_ACCESS || 'public').toLowerCase(); // 'public' | 'signed'
  const ttlSeconds = parseInt(process.env.GCS_SIGNED_URL_TTL || '604800', 10); // default 7 days

  const key = getPdfKey(userStage, extracted);
  const candidateNames = [];

  const primary = pdfKeyToObjectName(key);
  if (primary) candidateNames.push(primary);

  // Base stage fallback, e.g., 'Stage II'
  const baseMatch = key && key.match(/^(dcis\s*\/\s*stage\s*0|stage\s*(?:0|i{1,3}|iv))/i);
  if (baseMatch) {
    const baseKey = baseMatch[1]
      .replace(/\s+/g, ' ')
      .replace(/dcis\s*\/\s*stage\s*0/i, 'DCIS / Stage 0')
      .replace(/stage\s*iv/i, 'Stage IV')
      .replace(/stage\s*iii/i, 'Stage III')
      .replace(/stage\s*ii/i, 'Stage II')
      .replace(/stage\s*i(?!v)/i, 'Stage I')
      .replace(/stage\s*0/i, 'Stage 0');
    const baseObj = pdfKeyToObjectName(baseKey);
    if (baseObj && baseObj !== primary) candidateNames.push(baseObj);
  }

  for (const name of candidateNames) {
    const objectPath = prefix ? `${prefix}/${name}` : name;
    const exists = await fileExistsInGcs(bucketName, objectPath);
    if (!exists) continue;

    if (access === 'signed') {
      try {
        const options = {
          version: 'v4',
          action: 'read',
          expires: Date.now() + ttlSeconds * 1000
        };
        const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl(options);
        return url;
      } catch (e) {
        // Fall back to public URL if signing fails
        return buildGcsPublicUrl(bucketName, objectPath);
      }
    } else {
      return buildGcsPublicUrl(bucketName, objectPath);
    }
  }

  // If no object found, fall back to Drive mapping
  return getPdfLink(userStage, extracted) || '';
}

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
      from: `BCC CONNECT <${process.env.EMAIL_USER}>`,
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
