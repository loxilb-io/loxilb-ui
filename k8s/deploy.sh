#!/bin/bash

# LoxiLB UI Kubernetes Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="loxilb-system"
APP_NAME="loxilb-ui"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOMAIN="${DOMAIN:-loxilb-ui.example.com}"

echo -e "${BLUE}🚀 Starting LoxiLB UI deployment...${NC}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster. Please check your kubeconfig.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Kubernetes cluster connection verified${NC}"

# Function to wait for deployment
wait_for_deployment() {
    local name=$1
    local namespace=$2
    echo -e "${YELLOW}⏳ Waiting for deployment ${name} to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=300s deployment/${name} -n ${namespace}
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment ${name} is ready${NC}"
    else
        echo -e "${RED}❌ Deployment ${name} failed to become ready${NC}"
        exit 1
    fi
}

# Create namespace if it doesn't exist
echo -e "${YELLOW}📦 Creating namespace...${NC}"
kubectl apply -f namespace.yaml

# Apply ConfigMap
echo -e "${YELLOW}⚙️  Applying ConfigMap...${NC}"
kubectl apply -f configmap.yaml

# Apply Deployment
echo -e "${YELLOW}🚀 Deploying application...${NC}"
kubectl apply -f deployment.yaml

# Wait for deployment to be ready
wait_for_deployment ${APP_NAME} ${NAMESPACE}

# Apply Service
echo -e "${YELLOW}🌐 Creating Service...${NC}"
kubectl apply -f service.yaml

# Apply PodDisruptionBudget
echo -e "${YELLOW}🛡️  Applying PodDisruptionBudget...${NC}"
kubectl apply -f pdb.yaml

# Apply Ingress (optional)
# if [ -f "ingress.yaml" ] && [ "${SKIP_INGRESS:-false}" != "true" ]; then
#     echo -e "${YELLOW}🌍 Creating Ingress...${NC}"
#     kubectl apply -f ingress.yaml
#     echo -e "${GREEN}✅ Ingress created. Application should be accessible at: https://${DOMAIN}/netlox${NC}"
# fi

# Show deployment status
echo -e "${BLUE}📊 Deployment Status:${NC}"
kubectl get pods -n ${NAMESPACE} -l app=${APP_NAME}
kubectl get svc -n ${NAMESPACE} -l app=${APP_NAME}

# Show logs (optional)
if [ "${SHOW_LOGS:-false}" == "true" ]; then
    echo -e "${BLUE}📝 Recent logs:${NC}"
    kubectl logs -n ${NAMESPACE} -l app=${APP_NAME} --tail=20
fi

echo -e "${GREEN}🎉 LoxiLB UI deployment completed successfully!${NC}"
echo -e "${BLUE}ℹ️  To check status: kubectl get pods -n ${NAMESPACE}${NC}"
echo -e "${BLUE}ℹ️  To view logs: kubectl logs -n ${NAMESPACE} -l app=${APP_NAME}${NC}"
echo -e "${BLUE}ℹ️  To port-forward (for testing): kubectl port-forward -n ${NAMESPACE} service/${APP_NAME}-service --address 0.0.0.0 8080:80${NC}"