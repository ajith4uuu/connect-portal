const { BigQuery } = require('@google-cloud/bigquery');
const winston = require('winston');

class BigQueryService {
  constructor() {
    this.bigquery = new BigQuery();
    this.datasetId = process.env.BIGQUERY_DATASET || 'progress_connect_surveys';
    this.tableId = 'survey_responses';
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bigquery.log' })
      ]
    });
  }

  async ensureDatasetExists() {
    try {
      const [datasets] = await this.bigquery.getDatasets();
      const datasetExists = datasets.some(ds => ds.id === this.datasetId);
      
      if (!datasetExists) {
        this.logger.info(`Creating dataset ${this.datasetId}`);
        await this.bigquery.createDataset(this.datasetId, {
          location: 'US'
        });
        this.logger.info(`Dataset ${this.datasetId} created successfully`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error ensuring dataset exists:', error);
      throw error;
    }
  }

  async ensureTableExists() {
    try {
      const dataset = this.bigquery.dataset(this.datasetId);
      const [tables] = await dataset.getTables();
      const tableExists = tables.some(table => table.id === this.tableId);
      
      if (!tableExists) {
        this.logger.info(`Creating table ${this.tableId}`);
        
        const schema = [
          { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
          { name: 'survey_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'email', type: 'STRING', mode: 'NULLABLE' },
          { name: 'language', type: 'STRING', mode: 'REQUIRED' },
          
          // Patient Information
          { name: 'gender', type: 'STRING', mode: 'NULLABLE' },
          { name: 'age', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'country', type: 'STRING', mode: 'NULLABLE' },
          { name: 'province', type: 'STRING', mode: 'NULLABLE' },
          { name: 'year_of_diagnosis', type: 'INTEGER', mode: 'NULLABLE' },
          
          // Cancer Information
          { name: 'selected_stage', type: 'STRING', mode: 'NULLABLE' },
          { name: 'calculated_stage', type: 'STRING', mode: 'NULLABLE' },
          { name: 'lymph_nodes', type: 'STRING', mode: 'NULLABLE' },
          { name: 'laterality', type: 'STRING', mode: 'NULLABLE' },
          { name: 'dense_breasts', type: 'STRING', mode: 'NULLABLE' },
          
          // Biomarkers
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
          
          // Stage IV specific
          { name: 'spread_locations', type: 'STRING', mode: 'NULLABLE' },
          
          // Extracted data from documents
          { name: 'extracted_age', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'extracted_province', type: 'STRING', mode: 'NULLABLE' },
          { name: 'extracted_stage', type: 'STRING', mode: 'NULLABLE' },
          { name: 'extracted_erpr', type: 'STRING', mode: 'NULLABLE' },
          { name: 'extracted_her2', type: 'STRING', mode: 'NULLABLE' },
          { name: 'extracted_brca', type: 'STRING', mode: 'NULLABLE' },
          
          // System generated
          { name: 'bcc_packages', type: 'STRING', mode: 'NULLABLE' },
          { name: 'pdf_url', type: 'STRING', mode: 'NULLABLE' },
          { name: 'ai_summary', type: 'STRING', mode: 'NULLABLE' },
          { name: 'files_uploaded', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'processing_time_ms', type: 'INTEGER', mode: 'NULLABLE' },
          
          // Raw data for audit
          { name: 'raw_answers', type: 'JSON', mode: 'NULLABLE' },
          { name: 'raw_extracted', type: 'JSON', mode: 'NULLABLE' }
        ];
        
        const options = {
          schema: schema,
          timePartitioning: {
            type: 'DAY',
            field: 'timestamp'
          },
          clustering: {
            fields: ['selected_stage', 'country', 'language']
          }
        };
        
        await dataset.createTable(this.tableId, options);
        this.logger.info(`Table ${this.tableId} created successfully`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error ensuring table exists:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      await this.ensureDatasetExists();
      await this.ensureTableExists();
      this.logger.info('BigQuery service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Error initializing BigQuery service:', error);
      throw error;
    }
  }

  async insertSurveyResponse(data) {
    try {
      const dataset = this.bigquery.dataset(this.datasetId);
      const table = dataset.table(this.tableId);
      
      // Generate unique survey ID
      const surveyId = `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const row = {
        timestamp: new Date().toISOString(),
        survey_id: surveyId,
        email: data.answers.email || null,
        language: data.language || 'en',
        
        // Patient Information
        gender: data.answers.gender || null,
        age: parseInt(data.answers.age) || null,
        country: data.answers.country || null,
        province: data.answers.province || null,
        year_of_diagnosis: parseInt(data.answers.year) || null,
        
        // Cancer Information
        selected_stage: data.answers.stage || null,
        calculated_stage: data.calculatedStage || null,
        lymph_nodes: data.answers.lymphNodes || null,
        laterality: data.answers.laterality || null,
        dense_breasts: data.answers.denseBreasts || null,
        
        // Biomarkers
        erpr_status: data.answers.ERPR || data.extracted.ERPR || null,
        her2_status: data.answers.HER2 || data.extracted.HER2 || null,
        luminal_subtype: data.answers.luminal || null,
        brca_status: data.answers.BRCA || data.extracted.BRCA || null,
        pik3ca_status: data.answers.PIK3CA || null,
        esr1_status: data.answers.ESR1 || null,
        pdl1_status: data.answers.PDL1 || null,
        msi_status: data.answers.MSI || null,
        ki67_status: data.answers.Ki67 || null,
        pten_status: data.answers.PTEN || null,
        akt1_status: data.answers.AKT1 || null,
        
        // Stage IV specific
        spread_locations: Array.isArray(data.answers.spread) 
          ? data.answers.spread.join('; ') 
          : data.answers.spread || null,
        
        // Extracted data from documents
        extracted_age: parseInt(data.extracted.age) || null,
        extracted_province: data.extracted.province || null,
        extracted_stage: data.extracted.stage || null,
        extracted_erpr: data.extracted.ERPR || null,
        extracted_her2: data.extracted.HER2 || null,
        extracted_brca: data.extracted.BRCA || null,
        
        // System generated
        bcc_packages: data.packages ? data.packages.join('; ') : null,
        pdf_url: data.pdfUrl || null,
        ai_summary: data.summary || null,
        files_uploaded: data.filesUploaded || 0,
        processing_time_ms: data.processingTime || null,
        
        // Raw data for audit
        raw_answers: JSON.stringify(data.answers),
        raw_extracted: JSON.stringify(data.extracted)
      };
      
      await table.insert(row);
      this.logger.info(`Survey response inserted successfully: ${surveyId}`);
      
      return {
        success: true,
        surveyId,
        message: 'Survey response saved successfully'
      };
    } catch (error) {
      this.logger.error('Error inserting survey response:', error);
      throw error;
    }
  }

  async getSurveyAnalytics() {
    try {
      const dataset = this.bigquery.dataset(this.datasetId);
      const table = dataset.table(this.tableId);
      
      const query = `
        SELECT 
          selected_stage,
          COUNT(*) as count,
          country,
          language,
          AVG(age) as avg_age,
          COUNT(DISTINCT email) as unique_respondents
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY selected_stage, country, language
        ORDER BY count DESC
      `;
      
      const [rows] = await this.bigquery.query(query);
      return rows;
    } catch (error) {
      this.logger.error('Error getting survey analytics:', error);
      throw error;
    }
  }

  async getSurveyById(surveyId) {
    try {
      const dataset = this.bigquery.dataset(this.datasetId);
      const table = dataset.table(this.tableId);
      
      const query = `
        SELECT * 
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE survey_id = @surveyId
        LIMIT 1
      `;
      
      const options = {
        query,
        params: { surveyId }
      };
      
      const [rows] = await this.bigquery.query(options);
      return rows[0] || null;
    } catch (error) {
      this.logger.error('Error getting survey by ID:', error);
      throw error;
    }
  }
}

module.exports = BigQueryService;