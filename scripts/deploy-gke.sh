#!/bin/bash
# OptChain GKE Deployment Script
# Usage: ./scripts/deploy-gke.sh [PROJECT_ID] [CLUSTER_NAME] [REGION]

set -e

# Configuration
PROJECT_ID="${1:-mythic-delight-114820}"
CLUSTER_NAME="${2:-optchain-cluster}"
REGION="${3:-us-west1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/optchain"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=========================================="
echo "OptChain GKE Deployment"
echo "=========================================="
echo "Project:  ${PROJECT_ID}"
echo "Cluster:  ${CLUSTER_NAME}"
echo "Region:   ${REGION}"
echo "Image:    ${IMAGE_NAME}:${IMAGE_TAG}"
echo "=========================================="

# Check required tools
command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI required but not installed. Aborting." >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker required but not installed. Aborting." >&2; exit 1; }

# Set GCP project
echo ""
echo ">>> Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Authenticate with GCR
echo ""
echo ">>> Authenticating with GCR..."
gcloud auth configure-docker gcr.io --quiet

# Build and push Docker image
echo ""
echo ">>> Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest

echo ""
echo ">>> Pushing Docker image to GCR..."
docker push ${IMAGE_NAME}:${IMAGE_TAG}
docker push ${IMAGE_NAME}:latest

# Get GKE credentials
echo ""
echo ">>> Getting GKE credentials..."
gcloud container clusters get-credentials ${CLUSTER_NAME} --region ${REGION}

# Update image in deployment
echo ""
echo ">>> Updating Kubernetes manifests..."
sed -i.bak "s|gcr.io/PROJECT_ID/optchain|${IMAGE_NAME}|g" k8s/deployment.yaml
sed -i.bak "s|gcr.io/PROJECT_ID/optchain|${IMAGE_NAME}|g" k8s/kustomization.yaml

# Create namespace if not exists
echo ""
echo ">>> Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Create secrets (if not exist)
echo ""
echo ">>> Checking secrets..."
if ! kubectl get secret optchain-secrets -n optchain >/dev/null 2>&1; then
    echo "WARNING: optchain-secrets not found. Create it with:"
    echo "  kubectl create secret generic optchain-secrets \\"
    echo "    --from-literal=GEMINI_API_KEY=your-api-key \\"
    echo "    --from-literal=GCS_PROMPTS_PATH=gs://your-bucket/prompts \\"
    echo "    -n optchain"
fi

# Apply Kubernetes manifests
echo ""
echo ">>> Deploying to GKE..."
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml

# Apply ingress (optional - requires static IP and domain)
read -p "Apply Ingress configuration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f k8s/ingress.yaml
fi

# Restore original files
mv k8s/deployment.yaml.bak k8s/deployment.yaml
mv k8s/kustomization.yaml.bak k8s/kustomization.yaml

# Wait for deployment
echo ""
echo ">>> Waiting for deployment to be ready..."
kubectl rollout status deployment/optchain -n optchain --timeout=300s

# Get service info
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
kubectl get pods -n optchain
echo ""
kubectl get services -n optchain
echo ""
kubectl get ingress -n optchain 2>/dev/null || echo "No ingress configured"
echo ""
echo "To access the application:"
echo "  - NodePort: kubectl get nodes -o wide (use EXTERNAL-IP:30080)"
echo "  - Ingress:  kubectl get ingress -n optchain (use ADDRESS)"
echo ""
echo "To view logs:"
echo "  kubectl logs -f deployment/optchain -n optchain"
echo ""
