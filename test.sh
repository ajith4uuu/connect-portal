#!/bin/bash

# BCC Portal - Production Test Script
# This script tests the deployed application endpoints

set -e

echo "🧪 BCC Portal Test Suite"
echo "========================"

# Get service URL
if [ -z "$1" ]; then
    read -p "Enter your Cloud Run service URL: " SERVICE_URL
else
    SERVICE_URL=$1
fi

# Remove trailing slash if present
SERVICE_URL=${SERVICE_URL%/}

echo "Testing: $SERVICE_URL"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_code=$2
    local description=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL$endpoint")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response, expected $expected_code)"
        return 1
    fi
}

# Function to test POST endpoint
test_post_endpoint() {
    local endpoint=$1
    local data=$2
    local expected_code=$3
    local description=$4
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$SERVICE_URL$endpoint")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response, expected $expected_code)"
        return 1
    fi
}

# Track test results
PASSED=0
FAILED=0

echo "1. Basic Connectivity Tests"
echo "----------------------------"

# Test health endpoint
if test_endpoint "/health" "200" "Health check"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "2. API Endpoint Tests"
echo "----------------------"

# Test translations endpoints
if test_endpoint "/api/translations/en" "200" "English translations"; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "/api/translations/fr" "200" "French translations"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test survey definition
if test_endpoint "/api/survey/en" "200" "English survey definition"; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_endpoint "/api/survey/fr" "200" "French survey definition"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "3. Data Validation Tests"
echo "-------------------------"

# Test translations content
echo -n "Validating translation content... "
content=$(curl -s "$SERVICE_URL/api/translations/en")
if echo "$content" | grep -q "app_title"; then
    echo -e "${GREEN}✓ PASS${NC} (Content valid)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Invalid content)"
    ((FAILED++))
fi

# Test survey definition structure
echo -n "Validating survey structure... "
survey=$(curl -s "$SERVICE_URL/api/survey/en")
if echo "$survey" | grep -q "gender"; then
    echo -e "${GREEN}✓ PASS${NC} (Structure valid)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Invalid structure)"
    ((FAILED++))
fi

echo ""
echo "4. Performance Tests"
echo "---------------------"

# Test response time
echo -n "Testing response time... "
start_time=$(date +%s%N)
curl -s "$SERVICE_URL/health" > /dev/null
end_time=$(date +%s%N)
elapsed_time=$(( ($end_time - $start_time) / 1000000 ))

if [ $elapsed_time -lt 1000 ]; then
    echo -e "${GREEN}✓ PASS${NC} (${elapsed_time}ms)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (${elapsed_time}ms - too slow)"
    ((FAILED++))
fi

echo ""
echo "5. Error Handling Tests"
echo "------------------------"

# Test 404 handling
if test_endpoint "/nonexistent" "404" "404 error handling"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test invalid language
if test_endpoint "/api/translations/invalid" "200" "Invalid language fallback"; then
    ((PASSED++))
else
    ((FAILED++))
fi

echo ""
echo "6. BigQuery Connection Test"
echo "----------------------------"

# Test submit endpoint (with minimal data)
test_data='{
    "extracted": {},
    "answers": {
        "email": "test@example.com",
        "age": "45",
        "stage": "Stage II"
    },
    "lang": "en"
}'

echo "Note: Submit endpoint test requires valid BigQuery setup"
echo "Skipping actual submission to avoid test data in production"
echo -e "${GREEN}✓ SKIP${NC} (Manual verification required)"

echo ""
echo "7. Security Tests"
echo "------------------"

# Test CORS headers
echo -n "Testing CORS headers... "
cors_header=$(curl -s -I "$SERVICE_URL/health" | grep -i "access-control-allow-origin")
if [ ! -z "$cors_header" ]; then
    echo -e "${GREEN}✓ PASS${NC} (CORS enabled)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (CORS not configured)"
    ((FAILED++))
fi

# Test security headers
echo -n "Testing security headers... "
security_headers=$(curl -s -I "$SERVICE_URL/health")
if echo "$security_headers" | grep -qi "x-content-type-options"; then
    echo -e "${GREEN}✓ PASS${NC} (Security headers present)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Security headers missing)"
    ((FAILED++))
fi

echo ""
echo "========================"
echo "Test Results Summary"
echo "========================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo "Success Rate: ${PERCENTAGE}%"
fi

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your deployment is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}⚠️ Some tests failed. Please check the deployment configuration.${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check service logs: gcloud run services logs read bcc-portal-backend"
    echo "2. Verify service account permissions"
    echo "3. Check Secret Manager configuration"
    echo "4. Ensure all APIs are enabled"
    exit 1
fi
