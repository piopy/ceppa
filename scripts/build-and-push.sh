#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <tag1> [tag2 ...]"
    echo "Example: $0 v0.2.0 latest"
    exit 1
fi

IMAGE_NAME="ermatrice94/ceppa"

# Build once with all tags
TAGS=()
for TAG in "$@"; do
    TAGS+=(-t "${IMAGE_NAME}:${TAG}")
done

echo "Building ${IMAGE_NAME} with tags: $*"
cd ..
docker build -f Dockerfile.hf "${TAGS[@]}" .

echo ""
echo "Logging in..."
docker login

echo ""
for TAG in "$@"; do
    echo "Pushing ${IMAGE_NAME}:${TAG}..."
    docker push "${IMAGE_NAME}:${TAG}"
done

echo ""
echo "Done! Tags pushed: $*"
echo ""
echo "On Hugging Face, use:"
echo "  FROM ${IMAGE_NAME}:${1}"
echo "  EXPOSE 7860"