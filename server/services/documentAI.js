const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { Storage } = require('@google-cloud/storage');
const winston = require('winston');

class DocumentAIService {
  constructor() {
    this.client = new DocumentProcessorServiceClient();
    this.storage = new Storage();
    this.projectId = process.env.GCP_PROJECT_ID;
    this.location = process.env.DOCUMENT_AI_LOCATION || 'us';
    this.processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    this.bucketName = process.env.GCS_BUCKET_NAME;
    
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'documentai.log' })
      ]
    });
  }

  async uploadToGCS(file, filename) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const filePath = `reports/${Date.now()}_${filename}`;
      const fileObj = bucket.file(filePath);
      
      await fileObj.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      this.logger.info(`File uploaded to GCS: ${filePath}`);
      return `gs://${this.bucketName}/${filePath}`;
    } catch (error) {
      this.logger.error('Error uploading to GCS:', error);
      throw error;
    }
  }

  async processDocument(gcsUri, mimeType = 'application/pdf') {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;
      
      const request = {
        name,
        rawDocument: {
          content: gcsUri,
          mimeType,
        },
      };
      
      const [result] = await this.client.processDocument(request);
      const { document } = result;
      
      this.logger.info('Document processed successfully');
      return document;
    } catch (error) {
      this.logger.error('Error processing document:', error);
      throw error;
    }
  }

  async processDocumentFromBuffer(buffer, mimeType = 'application/pdf') {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;
      
      const request = {
        name,
        rawDocument: {
          content: buffer.toString('base64'),
          mimeType,
        },
      };
      
      const [result] = await this.client.processDocument(request);
      const { document } = result;
      
      this.logger.info('Document processed successfully from buffer');
      return document;
    } catch (error) {
      this.logger.error('Error processing document from buffer:', error);
      throw error;
    }
  }

  extractDataFromDocument(document) {
    const text = document.text || '';
    const extracted = {
      province: this.extractProvince(text),
      age: this.extractAge(text),
      stage: this.extractStage(text),
      ERPR: this.extractERPR(text),
      HER2: this.extractHER2(text),
      BRCA: this.extractBRCA(text),
      luminal: this.extractLuminal(text),
      PIK3CA: this.extractPIK3CA(text),
      ESR1: this.extractESR1(text),
      PDL1: this.extractPDL1(text),
      MSI: this.extractMSI(text),
      Ki67: this.extractKi67(text),
      PTEN: this.extractPTEN(text),
      AKT1: this.extractAKT1(text)
    };
    
    this.logger.info('Data extracted from document:', extracted);
    return extracted;
  }

  extractProvince(text) {
    const patterns = [
      /Province[:\s-]*([A-Z]{2})/i,
      /Province\/State[:\s-]*(\w+)/i,
      /Location[:\s-]*(\w+\s?\w+)/i,
      /(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  extractAge(text) {
    const ageMatch = text.match(/\bAge\s*[:\-]?\s*(\d+)\b/i) || 
                    text.match(/\bDOB\b.*?(\d{2,4})\b/i) || 
                    text.match(/\bDate\s*of\s*Birth\b.*?(\d{2,4})\b/i);
    
    if (ageMatch && ageMatch[1]) {
      const currentYear = new Date().getFullYear();
      const year = parseInt(ageMatch[1]);
      if (year > 1900 && year <= currentYear) {
        return (currentYear - year).toString();
      } else if (year >= 18 && year <= 120) {
        return year.toString();
      }
    }
    return null;
  }

  extractStage(text) {
    const patterns = [
      /Stage\s*[:\s-]*([0IV]+)/i,
      /Stage\s*([0IV]+)/i,
      /(Stage\s*[0-9IV]+)/i,
      /(DCIS|Stage 0|Stage I|Stage II|Stage III|Stage IV)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let stage = match[1].replace(/\s/g, '');
        const stageMap = {
          '0': 'DCIS / Stage 0',
          'I': 'Stage I',
          'II': 'Stage II',
          'III': 'Stage III',
          'IV': 'Stage IV',
          'DCIS': 'DCIS / Stage 0'
        };
        return stageMap[stage] || stage;
      }
    }
    return null;
  }

  extractERPR(text) {
    const erTests = [
      /(Estrogen|ER)[-\s]*(receptor)?[:\s-]*(Positive|Negative|Pos|Neg|Reactive|Non[- ]reactive)/i,
      /ER[:\s-]*(Positive|Negative|Pos|Neg)/i
    ];
    const prTests = [
      /(Progesterone|PR)[-\s]*(receptor)?[:\s-]*(Positive|Negative|Pos|Neg|Reactive|Non[- ]reactive)/i,
      /PR[:\s-]*(Positive|Negative|Pos|Neg)/i
    ];
    
    let erPos = null, prPos = null;
    
    for (const re of erTests) {
      const m = text.match(re);
      if (m) {
        erPos = /pos|reactive/i.test(m[3]);
        break;
      }
    }
    
    for (const re of prTests) {
      const m = text.match(re);
      if (m) {
        prPos = /pos|reactive/i.test(m[3]);
        break;
      }
    }
    
    if (erPos !== null && prPos !== null) {
      return `${erPos ? 'ER+' : 'ER–'} & ${prPos ? 'PR+' : 'PR–'}`;
    }
    return null;
  }

  extractHER2(text) {
    const patterns = [
      /HER[-]?2[^\d]*(?:IHC)?[^\d]*(0|1|2|3)[+ ]?(?:positive|negative)?/i,
      /HER[-]?2[^:]*[:\-]?\s*(Positive|Negative|Equivocal|Overexpression|Amplified)/i,
      /HER[-]?2\/neu[^:]*[:\-]?\s*(Positive|Negative|Equivocal)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1] === '0' || /negative/i.test(match[1])) {
          return 'HER-2 Negative (0)';
        } else if (match[1] === '1' || match[1] === '2' || /equivocal/i.test(match[1])) {
          return 'HER-2 Low (1+ or 2+)';
        } else if (match[1] === '3' || /positive|overexpression|amplified/i.test(match[1])) {
          return 'HER-2 High (3+)';
        }
      }
    }
    return null;
  }

  extractBRCA(text) {
    const match = text.match(/BRCA[12][:\s-]*(Positive|Negative|Mutation|Not\s+tested)/i);
    return match ? match[1] : null;
  }

  extractLuminal(text) {
    const patterns = [
      /Luminal\s*(?:subtype|type)[:\s]*(A|B)/i,
      /Luminal\s*[AB]/i,
      /(Luminal A|Luminal B)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] ? `Luminal ${match[1]}` : match[0];
      }
    }
    return null;
  }

  extractPIK3CA(text) {
    const match = text.match(/PIK3CA[:\s-]*(Positive|Negative|Mutation|Not\s+tested)/i);
    return match ? match[1] : null;
  }

  extractESR1(text) {
    const match = text.match(/ESR1[:\s-]*(Positive|Negative|Mutation|Not\s+tested)/i);
    return match ? match[1] : null;
  }

  extractPDL1(text) {
    const patterns = [
      /PD[-]?L1[:\s-]*(High|Low|Positive|Negative|Expression)/i,
      /Programmed Death Ligand 1[:\s-]*(High|Low|Positive|Negative)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (/high|positive/i.test(match[1])) {
          return 'PD-L1 High';
        } else if (/low|negative/i.test(match[1])) {
          return 'PD-L1 Low';
        }
      }
    }
    return null;
  }

  extractMSI(text) {
    const match = text.match(/MSI[:\s-]*(High|Low|Stable|Instability)/i);
    return match ? `MSI-${/high/i.test(match[1]) ? 'High' : 'Low'}` : null;
  }

  extractKi67(text) {
    const match = text.match(/Ki-?67[:\s-]*(\d+)%/i);
    return match ? (+match[1] >= 20 ? 'High (≥20%)' : 'Low (<20%)') : null;
  }

  extractPTEN(text) {
    const match = text.match(/PTEN[:\s-]*(Positive|Negative|Mutation|Not\s+tested)/i);
    return match ? match[1] : null;
  }

  extractAKT1(text) {
    const match = text.match(/AKT1[:\s-]*(Positive|Negative|Mutation|Not\s+tested)/i);
    return match ? match[1] : null;
  }

  async processMultipleFiles(files) {
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

    for (const file of files) {
      try {
        this.logger.info(`Processing file: ${file.originalname}`);
        
        // Upload to GCS
        const gcsUri = await this.uploadToGCS(file, file.originalname);
        
        // Process with Document AI
        const document = await this.processDocument(gcsUri, file.mimetype);
        
        // Extract data
        const fileData = this.extractDataFromDocument(document);
        
        // Merge results
        for (const key in fileData) {
          if (fileData[key] && fileData[key] !== null) {
            results[key] = fileData[key];
          }
        }
        
        filesProcessed++;
        this.logger.info(`Successfully processed file: ${file.originalname}`);
        
      } catch (error) {
        this.logger.error(`Error processing file ${file.originalname}:`, error);
        // Continue with other files even if one fails
      }
    }

    return {
      ...results,
      filesProcessed
    };
  }
}

module.exports = DocumentAIService;