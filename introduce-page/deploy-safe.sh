#!/bin/bash

# SpeakTracker Landing Page 안전 배포 스크립트
# CloudFront OAC (Origin Access Control) 사용

BUCKET_NAME="speaktracker-landing"
REGION="ap-northeast-2"

echo "========================================="
echo "SpeakTracker Landing Page 안전 배포"
echo "========================================="

# 1. 버킷 생성 (완전 Private)
echo ""
echo "1단계: Private S3 버킷 생성 중..."
aws s3 mb s3://${BUCKET_NAME} --region ${REGION} 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✓ 버킷 생성 완료"
else
  echo "ℹ 버킷이 이미 존재합니다"
fi

# 2. 퍼블릭 액세스 차단 활성화 (보안 강화)
echo ""
echo "2단계: 퍼블릭 액세스 차단 활성화 중..."
aws s3api put-public-access-block \
  --bucket ${BUCKET_NAME} \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✓ 퍼블릭 액세스 차단 활성화 완료"

# 3. 버전 관리 활성화 (안전장치)
echo ""
echo "3단계: 버전 관리 활성화 중..."
aws s3api put-bucket-versioning \
  --bucket ${BUCKET_NAME} \
  --versioning-configuration Status=Enabled
echo "✓ 버전 관리 활성화 완료"

# 4. 파일 업로드 (Private)
echo ""
echo "4단계: 파일 업로드 중..."
aws s3 sync . s3://${BUCKET_NAME} \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "*.json" \
  --exclude "*.sh" \
  --exclude ".git/*" \
  --cache-control "max-age=86400" \
  --delete

if [ $? -eq 0 ]; then
  echo "✓ 파일 업로드 완료"
else
  echo "✗ 파일 업로드 실패"
  exit 1
fi

# 5. CloudFront OAC 생성
echo ""
echo "5단계: CloudFront Origin Access Control 생성 중..."
OAC_CONFIG='{
  "Name": "speaktracker-landing-oac",
  "Description": "OAC for SpeakTracker landing page",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}'

OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config "$OAC_CONFIG" \
  --query 'OriginAccessControl.Id' \
  --output text 2>/dev/null)

if [ -z "$OAC_ID" ]; then
  echo "ℹ OAC가 이미 존재하거나 생성 실패 (수동 생성 필요)"
else
  echo "✓ OAC 생성 완료: $OAC_ID"
fi

# 6. CloudFront 배포 생성 안내
echo ""
echo "========================================="
echo "✅ S3 업로드 완료!"
echo "========================================="
echo ""
echo "📋 다음 단계 (AWS Console에서 수행):"
echo ""
echo "1. CloudFront 콘솔로 이동"
echo "   https://console.aws.amazon.com/cloudfront"
echo ""
echo "2. '배포 생성' 클릭"
echo ""
echo "3. 설정:"
echo "   - Origin domain: ${BUCKET_NAME}.s3.${REGION}.amazonaws.com"
echo "   - Origin access: Origin access control settings (recommended)"
echo "   - OAC 생성 또는 선택"
echo "   - Viewer protocol policy: Redirect HTTP to HTTPS"
echo "   - Default root object: index.html"
echo ""
echo "4. CloudFront가 생성한 버킷 정책을 S3에 자동 적용"
echo ""
echo "5. 배포 완료 후 CloudFront 도메인으로 접속"
echo "   예: https://d1234567890.cloudfront.net"
echo ""
echo "========================================="
echo ""
