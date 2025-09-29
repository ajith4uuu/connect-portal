# Progress CONNECT Patient Portal

A production-ready React Node.js application for Breast Cancer Canada's patient survey portal, deployed on Google Cloud Run with BigQuery backend and bilingual support.

## Features

### 🌐 Bilingual Support
- Full English and French language support
- Seamless language switching
- Localized content and UI elements

### 📋 Multi-Step Survey Wizard
- Progressive survey with validation
- Dynamic questions based on cancer stage
- File upload with Document AI analysis
- Real-time data extraction from pathology reports

### 🤖 AI-Powered Analysis
- Document AI integration for report analysis
- Gemini AI for personalized treatment summaries
- Automatic biomarker extraction
- Stage calculation from biomarkers

### 📊 BigQuery Backend
- Automatic schema creation
- Secure data storage
- Analytics and reporting
- GDPR compliant data handling

### 📧 Email Integration
- Personalized email confirmations
- Treatment recommendations delivery
- Download links for resources

### 🚀 Production Ready
- Deployed on Google Cloud Run
- Auto-scaling and load balancing
- Comprehensive error handling
- Logging and monitoring
- Security best practices

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Node.js API   │    │   Google Cloud  │
│                 │    │                 │    │                 │
│ • Multi-step    │◄──►│ • Express.js    │◄──►│ • Cloud Run     │
│   survey wizard │    │ • API routes    │    │ • BigQuery      │
│ • File upload   │    │ • Validation    │    │ • Document AI   │
│ • i18n support  │    │ • Services      │    │ • Cloud Storage │
│ • Progress bar  │    │ • Error handling│    │ • Secret Manager│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Node.js 18+
- Google Cloud Platform account
- Docker (for local development)
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/progress-connect-portal.git
cd progress-connect-portal
```

### 2. Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `DOCUMENT_AI_PROCESSOR_ID`: Document AI processor ID
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket name
- `GEMINI_API_KEY`: Gemini AI API key (optional)
- `EMAIL_USER`: Email service user (for production)
- `EMAIL_PASS`: Email service password (for production)

### 4. Local Development

```bash
# Run in development mode
npm run dev

# Or run separately
npm run server:dev  # Backend on http://localhost:5000
npm run client:dev  # Frontend on http://localhost:3000
```

### 5. Production Build

```bash
# Build the client
npm run build

# Start production server
npm start
```

## Deployment

### Automated Deployment with Cloud Build

1. Configure Cloud Build trigger:
```bash
gcloud beta builds triggers create cloud-source-repositories \
    --repo=progress-connect-portal \
    --branch-pattern=main \
    --build-config=cloudbuild.yaml
```

2. Push to main branch to trigger deployment
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

### Manual Deployment

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### Docker Deployment

```bash
# Build Docker image
docker build -t progress-connect .

# Run container
docker run -p 5000:5000 --env-file .env progress-connect
```

## Configuration

### Google Cloud Setup

1. **Enable Required APIs**:
```bash
gcloud services enable \
    run.googleapis.com \
    containerregistry.googleapis.com \
    cloudbuild.googleapis.com \
    documentai.googleapis.com \
    bigquery.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com
```

2. **Create Service Account**:
```bash
gcloud iam service-accounts create progress-connect-sa \
    --display-name="Progress Connect Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:progress-connect-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:progress-connect-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:progress-connect-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"
```

3. **Set up Document AI**:
   - Create a Document AI processor
   - Configure processor for medical documents
   - Get processor ID for configuration

4. **Create BigQuery Dataset**:
```bash
bq mk --dataset $PROJECT_ID:progress_connect_surveys
```

### Email Configuration

For production email delivery, configure one of the following:

1. **Gmail SMTP** (for testing):
   - Enable 2-factor authentication
   - Generate app-specific password
   - Update `EMAIL_USER` and `EMAIL_PASS`

2. **SendGrid** (recommended for production):
   - Sign up for SendGrid account
   - Create API key
   - Update email configuration

3. **Google Workspace**:
   - Set up Google Workspace account
   - Configure domain and email
   - Use Gmail SMTP with domain authentication

## API Documentation

### Survey Endpoints

#### Submit Survey
```http
POST /api/survey/submit
Content-Type: application/json

{
  "answers": {
    "email": "patient@example.com",
    "age": 45,
    "country": "Canada",
    "stage": "Stage II",
    // ... other answers
  },
  "extracted": {
    "ERPR": "ER+ & PR+",
    "HER2": "HER-2 High (3+)",
    // ... extracted data
  }
}
```

Response:
```json
{
  "success": true,
  "userStage": "Stage II ER+/PR+/HER2+",
  "calculatedStage": "Stage II",
  "packages": ["Stage II ER/PR+/HER2+ package", "HER2-targeted therapy"],
  "pdfUrl": "https://...",
  "summary": "AI-generated summary...",
  "surveyId": "survey_123456789"
}
```

#### Get Survey Questions
```http
GET /api/survey/questions/Stage%20II?lang=en
```

Response:
```json
{
  "success": true,
  "questions": [
    {
      "id": "gender",
      "type": "radio",
      "title": "What is your gender designated at birth?",
      "required": true,
      "options": ["Male", "Female"]
    }
    // ... more questions
  ]
}
```

### Upload Endpoints

#### Analyze Files
```http
POST /api/upload/analyze
Content-Type: multipart/form-data

files: [binary data]
```

Response:
```json
{
  "success": true,
  "extracted": {
    "ERPR": "ER+ & PR+",
    "HER2": "HER-2 High (3+)",
    "stage": "Stage II",
    // ... other biomarkers
  },
  "filesProcessed": 2
}
```

## Monitoring and Logging

### Cloud Logging

All application logs are sent to Google Cloud Logging:
- Application logs: `progress-connect-app`
- Error logs: `progress-connect-errors`
- Audit logs: `progress-connect-audit`

### Health Checks

Health check endpoint: `GET /api/health`

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 12345
}
```

### Metrics

Key metrics to monitor:
- Request latency
- Error rates
- Upload success rates
- Email delivery rates
- BigQuery insert success rates

## Security

### Data Protection
- All data encrypted in transit (HTTPS)
- Data encrypted at rest in BigQuery
- No PII stored without consent
- GDPR compliant data handling

### Access Control
- Service account based authentication
- Role-based access control (RBAC)
- API rate limiting
- Input validation and sanitization

### Security Headers
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

## Troubleshooting

### Common Issues

1. **Document AI Processing Fails**:
   - Check processor ID and location
   - Verify file format (PDF, JPG, PNG)
   - Check file size limits (10MB)

2. **BigQuery Insertion Fails**:
   - Verify dataset and table exist
   - Check service account permissions
   - Validate data format

3. **Email Delivery Fails**:
   - Check email credentials
   - Verify recipient email address
   - Check spam folder

4. **Deployment Fails**:
   - Check Cloud Build logs
   - Verify environment variables
   - Check service account permissions

### Debug Mode

Enable debug logging:
```bash
export NODE_ENV=development
export DEBUG=progress-connect:*
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For technical support:
- Create an issue in the GitHub repository
- Contact the development team
- Check the troubleshooting section

## Acknowledgments

- Breast Cancer Canada for the project opportunity
- Google Cloud Platform for infrastructure
- Document AI team for OCR capabilities
- Gemini AI team for natural language processing