# BCC Progress CONNECT Patient Portal - Production Deployment Guide

## 🚀 Production-Ready React/Node.js Application for Google Cloud Run

This is a fully functional, production-ready conversion of the BCC Progress CONNECT Patient Portal from Google Apps Script to a modern React/Node.js application deployed on Google Cloud Run.

## ✨ Features

- **Multi-language Support**: Full English and French language support with seamless switching
- **Document AI Integration**: Automatic extraction of pathology data from uploaded PDFs
- **BigQuery Backend**: Automatic schema creation and data persistence
- **Gemini AI Integration**: Personalized treatment summaries
- **Email Notifications**: Automated email delivery with treatment recommendations
- **Cloud Storage**: Secure document storage in GCS
- **Production Security**: Helmet, CORS, rate limiting, and authentication
- **Auto-scaling**: Cloud Run automatic scaling from 1 to 100 instances

## 📋 Prerequisites

1. **Google Cloud Project** with billing enabled
2. **APIs Enabled**:
   - Cloud Run API
   - Document AI API
   - BigQuery API
   - Cloud Storage API
   - Secret Manager API
   - Cloud Build API
3. **Service Account** with appropriate permissions
4. **Document AI Processor** created in your project
5. **Gmail Account** with App Password for email sending

## 🛠️ Quick Setup Guide

### Step 1: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-org/bcc-portal.git
cd bcc-portal

# Copy environment template
cp backend/.env.example backend/.env
```

### Step 2: Set Environment Variables

Edit `backend/.env` with your values:

```env
GCP_PROJECT_ID=your-project-id
DOCAI_LOCATION=us
DOCAI_PROCESSOR_ID=your-processor-id
GCS_BUCKET=bcc-documentai-pdfs
BQ_DATASET_ID=bcc_portal
BQ_TABLE_ID=survey_responses
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
GEMINI_API_KEY=your-gemini-key
FRONTEND_URL=https://your-frontend.com
PORT=8080
```

### Step 3: Create Service Account

```bash
# Set your project ID
export PROJECT_ID=your-project-id

# Create service account
gcloud iam service-accounts create bcc-portal-sa \
    --display-name="BCC Portal Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Step 4: Create Secrets in Secret Manager

```bash
# Create secrets for sensitive data
echo -n "your-processor-id" | gcloud secrets create docai-processor-id --data-file=-
echo -n "your-email@gmail.com" | gcloud secrets create email-user --data-file=-
echo -n "your-app-password" | gcloud secrets create email-app-password --data-file=-
echo -n "your-gemini-key" | gcloud secrets create gemini-api-key --data-file=-

# Grant service account access to secrets
gcloud secrets add-iam-policy-binding docai-processor-id \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding email-user \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding email-app-password \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gemini-api-key \
    --member="serviceAccount:bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Step 5: Create Document AI Processor

```bash
# Create Document AI processor (if not already created)
gcloud documentai processors create \
    --display-name="BCC Pathology Processor" \
    --type="FORM_PARSER_PROCESSOR" \
    --location=us

# Note the processor ID from the output
```

### Step 6: Deploy to Cloud Run

#### Option A: Using Cloud Build (Recommended)

```bash
# Submit build and deploy
gcloud builds submit --config=cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=bcc-portal-backend,_REGION=us-central1,_GCS_BUCKET=bcc-documentai-pdfs,_BQ_DATASET=bcc_portal
```

#### Option B: Manual Deployment

```bash
# Build Docker image
docker build -t gcr.io/$PROJECT_ID/bcc-portal-backend ./backend

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/bcc-portal-backend

# Deploy to Cloud Run
gcloud run deploy bcc-portal-backend \
    --image gcr.io/$PROJECT_ID/bcc-portal-backend \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --cpu 2 \
    --memory 2Gi \
    --max-instances 100 \
    --min-instances 1 \
    --port 8080 \
    --timeout 300 \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
    --set-env-vars="GCS_BUCKET=bcc-documentai-pdfs" \
    --set-env-vars="BQ_DATASET_ID=bcc_portal" \
    --set-env-vars="BQ_TABLE_ID=survey_responses" \
    --set-env-vars="DOCAI_LOCATION=us" \
    --set-secrets="DOCAI_PROCESSOR_ID=docai-processor-id:latest" \
    --set-secrets="EMAIL_USER=email-user:latest" \
    --set-secrets="EMAIL_APP_PASSWORD=email-app-password:latest" \
    --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
    --service-account="bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 7: Deploy Frontend (Optional - for separate frontend hosting)

#### Option A: Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase
cd frontend
firebase init hosting

# Build React app
npm install
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

#### Option B: Deploy to Cloud Run (as static site)

```bash
# Build React app
cd frontend
npm install
npm run build

# Create nginx configuration
cat > nginx.conf <<EOF
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api {
        proxy_pass https://bcc-portal-backend-xxxxx-uc.a.run.app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Create Dockerfile for frontend
cat > Dockerfile <<EOF
FROM nginx:alpine
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
EOF

# Build and deploy
docker build -t gcr.io/$PROJECT_ID/bcc-portal-frontend .
docker push gcr.io/$PROJECT_ID/bcc-portal-frontend
gcloud run deploy bcc-portal-frontend \
    --image gcr.io/$PROJECT_ID/bcc-portal-frontend \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --port 8080
```

## 📊 BigQuery Schema

The application automatically creates the following BigQuery schema:

| Field | Type | Description |
|-------|------|-------------|
| id | STRING | Unique response ID |
| timestamp | TIMESTAMP | Submission time |
| language | STRING | User's language (en/fr) |
| email | STRING | User's email |
| age | INTEGER | Patient age |
| gender | STRING | Patient gender |
| country | STRING | Country |
| province | STRING | Province/State |
| year_diagnosis | INTEGER | Year of diagnosis |
| selected_stage | STRING | User-selected stage |
| calculated_stage | STRING | System-calculated stage |
| lymph_nodes | STRING | Lymph node status |
| laterality | STRING | Affected breast |
| dense_breasts | STRING | Dense breast indicator |
| erpr_status | STRING | ER/PR status |
| her2_status | STRING | HER2 status |
| luminal_subtype | STRING | Luminal subtype |
| brca_status | STRING | BRCA status |
| pik3ca_status | STRING | PIK3CA status |
| esr1_status | STRING | ESR1 status |
| pdl1_status | STRING | PD-L1 status |
| msi_status | STRING | MSI status |
| ki67_status | STRING | Ki-67 status |
| pten_status | STRING | PTEN status |
| akt1_status | STRING | AKT1 status |
| spread_locations | STRING[] | Metastasis locations |
| treatment_packages | STRING[] | Recommended packages |
| pdf_url | STRING | PDF link |
| ai_summary | STRING | Gemini AI summary |
| extracted_data | JSON | Extracted data from PDF |
| raw_responses | JSON | Raw survey responses |

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Configured cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: All inputs validated and sanitized
- **Secret Manager**: Sensitive data stored securely
- **Service Account**: Least privilege access
- **HTTPS**: Enforced by Cloud Run

## 📈 Monitoring

### View Logs
```bash
gcloud run services logs read bcc-portal-backend --region=us-central1
```

### View Metrics
```bash
gcloud monitoring metrics-descriptors list --filter="metric.type:run.googleapis.com"
```

### BigQuery Queries
```sql
-- Total submissions
SELECT COUNT(*) as total_submissions 
FROM `project-id.bcc_portal.survey_responses`;

-- Submissions by stage
SELECT selected_stage, COUNT(*) as count 
FROM `project-id.bcc_portal.survey_responses` 
GROUP BY selected_stage 
ORDER BY count DESC;

-- Daily submissions
SELECT DATE(timestamp) as date, COUNT(*) as daily_count 
FROM `project-id.bcc_portal.survey_responses` 
GROUP BY date 
ORDER BY date DESC;
```

## 🧪 Testing

### Local Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in separate terminal)
cd frontend
npm install
npm start
```

### API Testing
```bash
# Health check
curl https://your-backend-url.run.app/health

# Get translations
curl https://your-backend-url.run.app/api/translations/en

# Get survey definition
curl https://your-backend-url.run.app/api/survey/fr
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| GCP_PROJECT_ID | Google Cloud Project ID | Yes |
| DOCAI_LOCATION | Document AI location (us/eu) | Yes |
| DOCAI_PROCESSOR_ID | Document AI processor ID | Yes |
| GCS_BUCKET | Cloud Storage bucket name | Yes |
| BQ_DATASET_ID | BigQuery dataset ID | Yes |
| BQ_TABLE_ID | BigQuery table ID | Yes |
| EMAIL_USER | Gmail address for sending | Yes |
| EMAIL_APP_PASSWORD | Gmail app-specific password | Yes |
| GEMINI_API_KEY | Google Gemini API key | Yes |
| FRONTEND_URL | Frontend URL for CORS | No |
| PORT | Server port (default: 8080) | No |

## 🤝 Support

For issues or questions:
1. Check logs: `gcloud run services logs read bcc-portal-backend`
2. Check BigQuery: Verify data is being stored
3. Check Document AI: Ensure processor is active
4. Check Secrets: Verify all secrets are accessible

## 📄 License

This project is proprietary to Breast Cancer Canada (BCC).

## 🙏 Acknowledgments

- Breast Cancer Canada for the original application
- Google Cloud Platform for infrastructure
- Document AI for intelligent document processing
- Gemini AI for personalized summaries

---

**Production Checklist:**
- [ ] Service account created with proper permissions
- [ ] All secrets stored in Secret Manager
- [ ] Document AI processor created and tested
- [ ] BigQuery dataset permissions verified
- [ ] Cloud Storage bucket created
- [ ] Email configuration tested
- [ ] CORS configured for frontend domain
- [ ] Monitoring and alerting set up
- [ ] Backup strategy implemented
- [ ] SSL/TLS certificates configured
- [ ] Load testing completed
- [ ] Security scan completed
