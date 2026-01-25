#!/bin/bash

# CloudFront + S3 배포 스크립트
BUCKET_NAME="speaktracker-landing"
REGION="ap-northeast-2"

echo "========================================="
echo "CloudFront + S3 배포 시작"
echo "========================================="

# 1. S3 버킷 생성 (Private)
echo ""
echo "1단계: Private S3 버킷 생성 중..."
aws s3 mb s3://${BUCKET_NAME} --region ${REGION} 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✓ 버킷 생성 완료"
else
  echo "ℹ 버킷이 이미 존재합니다"
fi

# 2. 퍼블릭 액세스 차단 활성화 (보안)
echo ""
echo "2단계: 퍼블릭 액세스 차단 설정 중..."
aws s3api put-public-access-block \
  --bucket ${BUCKET_NAME} \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✓ 퍼블릭 액세스 차단 완료 (안전)"

# 3. 파일 업로드
echo ""
echo "3단계: 파일 업로드 중..."
aws s3 sync . s3://${BUCKET_NAME} \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "*.json" \
  --exclude "*.sh" \
  --exclude ".git/*" \
  --cache-control "max-age=86400" \
  --delete
echo "✓ 파일 업로드 완료"

# 4. CloudFront Origin Access Control (OAC) 생성
echo ""
echo "4단계: CloudFront OAC 생성 중..."
OAC_NAME="${BUCKET_NAME}-oac"
OAC_ID=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id" \
  --output text 2>/dev/null)

if [ -z "$OAC_ID" ]; then
  OAC_CONFIG=$(cat <<EOF
{
  "Name": "${OAC_NAME}",
  "Description": "OAC for ${BUCKET_NAME}",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
EOF
)
  OAC_ID=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "$OAC_CONFIG" \
    --query 'OriginAccessControl.Id' \
    --output text)
  echo "✓ OAC 생성 완료: $OAC_ID"
else
  echo "✓ OAC 이미 존재: $OAC_ID"
fi

# 5. CloudFront Distribution 생성
echo ""
echo "5단계: CloudFront Distribution 생성 중..."

# 기존 배포 확인
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='${BUCKET_NAME}.s3.${REGION}.amazonaws.com'].Id" \
  --output text 2>/dev/null)

if [ -z "$DIST_ID" ]; then
  # CloudFront Distribution Config JSON 생성
  DIST_CONFIG=$(cat <<EOF
{
  "CallerReference": "speaktracker-$(date +%s)",
  "Comment": "SpeakTracker Landing Page",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${BUCKET_NAME}",
        "DomainName": "${BUCKET_NAME}.s3.${REGION}.amazonaws.com",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${BUCKET_NAME}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "PriceClass": "PriceClass_All"
}
EOF
)

  echo "$DIST_CONFIG" > /tmp/cloudfront-config.json

  DIST_ID=$(aws cloudfront create-distribution \
    --distribution-config file:///tmp/cloudfront-config.json \
    --query 'Distribution.Id' \
    --output text)

  if [ $? -eq 0 ]; then
    echo "✓ CloudFront Distribution 생성 완료: $DIST_ID"
  else
    echo "✗ CloudFront Distribution 생성 실패"
    exit 1
  fi
else
  echo "✓ CloudFront Distribution 이미 존재: $DIST_ID"
fi

# 6. S3 버킷 정책 업데이트 (CloudFront만 접근 허용)
echo ""
echo "6단계: S3 버킷 정책 설정 중..."

BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/${DIST_ID}"
        }
      }
    }
  ]
}
EOF
)

echo "$BUCKET_POLICY" > /tmp/bucket-policy.json

aws s3api put-bucket-policy \
  --bucket ${BUCKET_NAME} \
  --policy file:///tmp/bucket-policy.json

echo "✓ 버킷 정책 설정 완료 (CloudFront만 접근 가능)"

# 7. CloudFront 도메인 가져오기
echo ""
echo "7단계: CloudFront 정보 조회 중..."
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
  --id ${DIST_ID} \
  --query 'Distribution.DomainName' \
  --output text)

echo ""
echo "========================================="
echo "✅ 배포 완료!"
echo "========================================="
echo ""
echo "CloudFront URL:"
echo "https://${CLOUDFRONT_DOMAIN}"
echo ""
echo "Distribution ID: ${DIST_ID}"
echo ""
echo "⚠️  참고사항:"
echo "- CloudFront 배포가 전 세계에 전파되는데 5-10분 소요됩니다"
echo "- 배포 상태 확인: aws cloudfront get-distribution --id ${DIST_ID}"
echo ""
echo "📝 LandingPage.jsx에 사용할 URL:"
echo "https://${CLOUDFRONT_DOMAIN}"
echo ""

# URL을 파일에 저장
echo "https://${CLOUDFRONT_DOMAIN}" > cloudfront-url.txt
echo "✓ CloudFront URL을 cloudfront-url.txt에 저장했습니다"

# 8. CloudFront 캐시 무효화 (배포 후 즉시 반영)
echo ""
echo "8단계: CloudFront 캐시 무효화 중..."
aws cloudfront create-invalidation \
  --distribution-id ${DIST_ID} \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "✓ 캐시 무효화 완료 (1-2분 후 변경사항 반영)"
