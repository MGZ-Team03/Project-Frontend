#!/bin/bash

# CloudWatch 알람 설정 - 비정상 트래픽 감지
# 한달에 $5 이상 청구되면 알림

BUCKET_NAME="speaktracker-landing"
ALARM_EMAIL="your-email@example.com"  # 여기에 본인 이메일 입력

echo "========================================="
echo "CloudWatch 알람 설정"
echo "========================================="

# SNS Topic 생성
echo ""
echo "1. SNS Topic 생성 중..."
TOPIC_ARN=$(aws sns create-topic \
  --name speaktracker-landing-alarm \
  --query 'TopicArn' \
  --output text)

echo "✓ SNS Topic 생성 완료: $TOPIC_ARN"

# 이메일 구독 추가
echo ""
echo "2. 이메일 구독 추가 중..."
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint $ALARM_EMAIL

echo "✓ 이메일 구독 요청 전송 (이메일 확인 필요)"

# CloudWatch 알람 생성 - 요청 수 모니터링
echo ""
echo "3. 요청 수 알람 생성 중..."
aws cloudwatch put-metric-alarm \
  --alarm-name speaktracker-landing-high-requests \
  --alarm-description "S3 버킷에 비정상적으로 많은 요청 발생" \
  --metric-name NumberOfObjects \
  --namespace AWS/S3 \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 100000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $TOPIC_ARN

echo "✓ 요청 수 알람 설정 완료"

# 예상 비용 알람
echo ""
echo "4. 예상 비용 알람 생성 중..."
aws cloudwatch put-metric-alarm \
  --alarm-name speaktracker-landing-high-cost \
  --alarm-description "S3 예상 비용이 $5 초과" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 5.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $TOPIC_ARN \
  --dimensions Name=Currency,Value=USD

echo "✓ 비용 알람 설정 완료"

echo ""
echo "========================================="
echo "✅ 알람 설정 완료!"
echo "========================================="
echo ""
echo "📧 이메일($ALARM_EMAIL)로 전송된 구독 확인 링크를 클릭하세요"
echo ""
echo "설정된 알람:"
echo "- 시간당 요청 100,000회 초과 시 알림"
echo "- 예상 비용 $5 초과 시 알림"
echo ""
