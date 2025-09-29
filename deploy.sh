#!/bin/bash

# Progress CONNECT Portal Deployment Script
# This script deploys the application to Google Cloud Run

set -e

echo "🚀 Starting deployment process..."

# Check if required tools are installed
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-""}
SERVICE_NAME="progress-connect"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo "❌ GCP_PROJECT_ID environment variable is not set."
    echo "Please set it using: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Image: $IMAGE_NAME"

# Authenticate with Google Cloud
echo "🔐 Authenticating with Google Cloud..."
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    containerregistry.googleapis.com \
    cloudbuild.googleapis.com \
    documentai.googleapis.com \
    bigquery.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com

# Build Docker image
echo "🏗️ Building Docker image..."
docker build -t $IMAGE_NAME .

# Push image to Container Registry
echo "📤 Pushing image to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --max-instances 100 \
    --set-env-vars NODE_ENV=production \
    --timeout 300s \
    --concurrency 80

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📋 Next steps:"
echo "1. Update your DNS records to point to the service URL"
echo "2. Configure SSL certificate if needed"
echo "3. Set up monitoring and alerting"
echo "4. Test the application thoroughly"

# Save deployment info
cat > deployment-info.txt << EOF
Deployment Date: $(date)
Service URL: $SERVICE_URL
Image: $IMAGE_NAME
Project: $PROJECT_ID
Region: $REGION
EOF

echo "📄 Deployment information saved to deployment-info.txt"