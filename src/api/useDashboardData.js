
import axios from "./axios.js";
import api from "./axios.js";


export const getDashboard = async (tutorEmail) =>{

        if(!tutorEmail){
            return new Error("tutor Email is required");
        }
        const fetchData = async () => {
            try {
                const {data} = await axios.get(`https://ovcmaro4u8.execute-api.ap-northeast-2.amazonaws.com/Dev/api/dashboard?tutorEmail=${tutorEmail}`);
                console.log("getDashboard: ", data);
                return data;
            } catch (error) {
                console.error('Failed to fetch dashboard:', error.message);

                // API 에러 vs 네트워크 에러 구분
                if (error.response) {
                    // 서버가 응답했지만 에러 상태 코드
                    throw new Error(`API Error: ${error.response.status}`);
                } else if (error.request) {
                    // 요청은 보냈지만 응답 없음
                    throw new Error('Network Error: No response from server');
                } else {
                    // 요청 설정 중 에러
                    throw error;
                }
            }
        }
       return await fetchData();

}