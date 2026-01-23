import {useCallback, useEffect} from "react";
import axios from "axios";

// 훅과 별도로 상태 전송 함수 export
export const sendStudentStatus = async (userEmail, tutorEmail, page) => {
    if (!userEmail) {
        console.log("❌ 사용자 정보 없음");
        return null;
    }

    const payload = {
        action: page === "/logout" ? "logout" : page,
        data: {
            tutorEmail: tutorEmail || "ssdii44@naver.com",
            studentEmail: userEmail,
            status: page === "/logout" ? "inactive" : "active",
            room: page === "/chat" ? "ai" : page === "/practice" ? "sentence" : "no room",
        }
    }

    console.log(payload);

    try {
        const {data} = await axios.post("/api/student-status",
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`✅ ${page} 상태 전송 성공:`, data);
        return data;
    } catch (error) {
        console.log('❌student status 전송 실패:', error);
        throw error;
    }
};

export const useStudentStatus = (user, page) => {
    const sendStatus = useCallback(async () => {
        return sendStudentStatus(user?.email, user?.tutorEmail, page?.pathname || page);
    }, [user?.email, user?.tutorEmail, page]);

    useEffect(() => {
        sendStatus();
    }, [sendStatus]);

    return {sendStatus};
}