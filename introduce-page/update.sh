#!/bin/bash

# 간단한 업데이트 스크립트 (S3 업로드 + CloudFront 캐시 무효화)
BUCKET_NAME="speaktracker-landing"
DIST_ID="E28QTRJKDVJ65E"

echo "========================================="
echo "소개 페이지 업데이트 시작"
echo "========================================="

# 1. 파일 업로드
echo ""
echo "1단계: S3에 파일 업로드 중..."
aws s3 sync . s3://${BUCKET_NAME} \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "*.json" \
  --exclude "*.sh" \
  --exclude ".git/*" \
  --cache-control "max-age=86400" \
  --delete

echo "✓ 파일 업로드 완료"

# 2. CloudFront 캐시 무효화
echo ""
echo "2단계: CloudFront 캐시 무효화 중..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DIST_ID} \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✓ 캐시 무효화 시작: ${INVALIDATION_ID}"

echo ""
echo "========================================="
echo "✅ 업데이트 완료!"
echo "========================================="
echo ""
echo "⏱  1-2분 후 변경사항이 반영됩니다"
echo ""
echo "CloudFront URL: https://d2zczzecj3n92n.cloudfront.net"
echo ""
