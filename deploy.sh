#!/bin/bash

# BCC Portal - Production Deployment Script
# This script automates the deployment process to Google Cloud Run

set -e

echo "🚀 BCC Portal Deployment Script"
echo "================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed. Please install it first."
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
read -p "Enter your Google Cloud Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: Project ID is required"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

echo "✅ Using project: $PROJECT_ID"

# Enable required APIs
echo "📦 Enabling required Google Cloud APIs..."
gcloud services enable run.googleapis.com \
    documentai.googleapis.com \
    bigquery.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com

echo "✅ APIs enabled"

# Service account setup
echo "👤 Service account setup"
read -p "Enter existing service account email to use (or press Enter to create one): " SA_EMAIL
if [ -z "$SA_EMAIL" ]; then
    echo "Creating service account..."
    gcloud iam service-accounts create bcc-portal-sa \
        --display-name="BCC Portal Service Account" \
        --quiet || echo "Service account already exists"
    SERVICE_ACCOUNT="bcc-portal-sa@$PROJECT_ID.iam.gserviceaccount.com"
else
    SERVICE_ACCOUNT="$SA_EMAIL"
fi

# Grant roles to service account
echo "🔐 Granting permissions to service account..."
for role in \
    "roles/documentai.apiUser" \
    "roles/bigquery.dataEditor" \
    "roles/bigquery.jobUser" \
    "roles/storage.admin" \
    "roles/secretmanager.secretAccessor" \
    "roles/run.invoker"
do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="$role" \
        --quiet || true
done

echo "✅ Service account configured: $SERVICE_ACCOUNT"

# Create GCS bucket
echo "🗂️ Creating Cloud Storage bucket..."
BUCKET_NAME="bcc-documentai-pdfs-$PROJECT_ID"
gsutil mb -p $PROJECT_ID -l us-central1 gs://$BUCKET_NAME || echo "Bucket already exists"
echo "✅ Bucket created: $BUCKET_NAME"

# Create BigQuery dataset
echo "📊 BigQuery dataset setup"
read -p "Enter BigQuery dataset ID (default: progressconnect): " DATASET_ID
DATASET_ID=${DATASET_ID:-progressconnect}
bq mk -f --location=US --dataset $PROJECT_ID:$DATASET_ID || echo "Dataset already exists"
echo "✅ BigQuery dataset: $DATASET_ID"

# Get Document AI processor ID
echo "📄 Document AI Setup"
echo "Please create a Document AI processor manually:"
echo "1. Go to: https://console.cloud.google.com/ai/document-ai/processors"
echo "2. Create a new processor of type 'Form Parser'"
echo "3. Note the processor ID"
read -p "Enter your Document AI Processor ID: " PROCESSOR_ID

# Get email credentials
echo "📧 Email Configuration"
read -p "Enter Gmail address for sending emails: " EMAIL_USER
read -s -p "Enter Gmail app-specific password: " EMAIL_PASSWORD
echo

# Get Gemini API key
echo "🤖 Gemini AI Configuration"
read -p "Enter Gemini API Key (or press Enter to skip): " GEMINI_KEY

# Create secrets
echo "🔒 Creating secrets in Secret Manager..."
echo -n "$PROCESSOR_ID" | gcloud secrets create docai-processor-id --data-file=- --quiet || \
    echo -n "$PROCESSOR_ID" | gcloud secrets versions add docai-processor-id --data-file=-

echo -n "$EMAIL_USER" | gcloud secrets create email-user --data-file=- --quiet || \
    echo -n "$EMAIL_USER" | gcloud secrets versions add email-user --data-file=-

echo -n "$EMAIL_PASSWORD" | gcloud secrets create email-app-password --data-file=- --quiet || \
    echo -n "$EMAIL_PASSWORD" | gcloud secrets versions add email-app-password --data-file=-

if [ ! -z "$GEMINI_KEY" ]; then
    echo -n "$GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=- --quiet || \
        echo -n "$GEMINI_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
fi

# Grant service account access to secrets
for secret in "docai-processor-id" "email-user" "email-app-password" "gemini-api-key"; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet || true
done

echo "✅ Secrets configured"

# Build and deploy backend
echo "🏗️ Building and deploying backend..."
cd backend

# Build Docker image
docker build -t gcr.io/$PROJECT_ID/bcc-portal-backend .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/bcc-portal-backend

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
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
    --set-env-vars="GCS_BUCKET=$BUCKET_NAME" \
    --set-env-vars="BQ_DATASET_ID=$DATASET_ID" \
    --set-env-vars="BQ_TABLE_ID=survey_responses" \
    --set-env-vars="DOCAI_LOCATION=us" \
    --set-secrets="DOCAI_PROCESSOR_ID=docai-processor-id:latest" \
    --set-secrets="EMAIL_USER=email-user:latest" \
    --set-secrets="EMAIL_APP_PASSWORD=email-app-password:latest" \
    --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
    --service-account="$SERVICE_ACCOUNT"

# Get service URL
SERVICE_URL=$(gcloud run services describe bcc-portal-backend \
    --region us-central1 \
    --format 'value(status.url)')

echo "✅ Backend deployed successfully!"
echo "🌐 Service URL: $SERVICE_URL"

# Optional: Deploy frontend
echo ""
read -p "Do you want to deploy the frontend? (y/n): " DEPLOY_FRONTEND

if [ "$DEPLOY_FRONTEND" = "y" ]; then
    cd ../frontend
    
    # Update API endpoint in frontend
    echo "REACT_APP_API_URL=$SERVICE_URL" > .env
    
    # Build React app
    npm install
    npm run build
    
    # Create nginx config
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
        proxy_pass $SERVICE_URL;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
    
    # Create Dockerfile
    cat > Dockerfile <<EOF
FROM nginx:alpine
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
EOF
    
    # Build and deploy frontend
    docker build -t gcr.io/$PROJECT_ID/bcc-portal-frontend .
    docker push gcr.io/$PROJECT_ID/bcc-portal-frontend
    
    gcloud run deploy bcc-portal-frontend \
        --image gcr.io/$PROJECT_ID/bcc-portal-frontend \
        --region us-central1 \
        --platform managed \
        --allow-unauthenticated \
        --port 8080
    
    FRONTEND_URL=$(gcloud run services describe bcc-portal-frontend \
        --region us-central1 \
        --format 'value(status.url)')
    
    echo "✅ Frontend deployed successfully!"
    echo "🌐 Frontend URL: $FRONTEND_URL"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "========================"
echo "Backend URL: $SERVICE_URL"
[ ! -z "$FRONTEND_URL" ] && echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "Next steps:"
echo "1. Test the health endpoint: curl $SERVICE_URL/health"
echo "2. Monitor logs: gcloud run services logs read bcc-portal-backend --region=us-central1"
echo "3. View metrics in Cloud Console"
echo ""
echo "Thank you for using BCC Portal!"
