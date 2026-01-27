/**
 * 대화 연습 시나리오 목록
 * UI 표시용 메타데이터만 포함 (실제 프롬프트는 백엔드에서 관리)
 */

export const scenarios = [
  {
    id: 'small_talk',
    title: '일상 대화',
    icon: 'Chat',
    description: '친구와 자유로운 일상 대화',
  },
  {
    id: 'restaurant',
    title: '레스토랑 주문',
    icon: 'Restaurant',
    description: '레스토랑에서 주문하고 대화하는 연습',
  },
  {
    id: 'airport',
    title: '공항 체크인',
    icon: 'Flight',
    description: '공항에서 체크인하고 탑승 절차 진행',
  },
  {
    id: 'shopping',
    title: '쇼핑',
    icon: 'ShoppingCart',
    description: '가게에서 쇼핑하고 물건 구매하기',
  },
  {
    id: 'hotel',
    title: '호텔 체크인',
    icon: 'Hotel',
    description: '호텔 체크인 및 문의사항 처리',
  },
  {
    id: 'doctor',
    title: '병원 진료',
    icon: 'LocalHospital',
    description: '의사와 증상 상담하기',
  },
  {
    id: 'job_interview',
    title: '면접',
    icon: 'Work',
    description: '영어 면접 연습',
  },
  {
    id: 'directions',
    title: '길 찾기',
    icon: 'Map',
    description: '길을 묻고 설명 듣기',
  }
];

/**
 * ID로 시나리오 찾기
 */
export function getScenarioById(id) {
  return scenarios.find(s => s.id === id);
}

/**
 * 기본 시나리오 반환
 */
export function getDefaultScenario() {
  return scenarios[0]; // small_talk
}
