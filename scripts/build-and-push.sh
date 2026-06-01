#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <tag>"
    echo "Example: $0 v0.2.0"
    exit 1
fi

TAG="$1"
IMAGE="ermatrice94/ceppa:${TAG}"

echo "Building ${IMAGE}..."
cd ..
docker build -f Dockerfile.hf -t "${IMAGE}" .

echo ""
echo "Pushing ${IMAGE}..."
docker login && docker push "${IMAGE}"

echo ""
echo "Done! Image pushed: ${IMAGE}"
echo ""
echo "On Hugging Face, use:"
echo "  FROM ${IMAGE}"
echo "  EXPOSE 7860"