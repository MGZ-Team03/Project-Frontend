import {useCallback, useEffect} from "react";
import api from "./axios";

// 훅과 별도로 상태 전송 함수 export
export const sendStudentStatus = async (userEmail, tutorEmail, page) => {
    if (!userEmail) {
        return null;
    }

    const payload = {
        action: page === "/logout" ? "logout" : page,
        data: {
            studentEmail: userEmail,
            status: page === "/logout" ? "inactive" : "active",
            room: page === "/chat" ? "ai" : page === "/practice" ? "sentence" : "no room",
        }
    }

    console.log(payload);

    try {
        const {data} = await api.post("/api/student-status", payload);
        return data;
    } catch (error) {
        throw error;
    }
};

export const sendStudentStatusSync = async (userEmail, tutorEmail) => {
    if (!userEmail) {
        return null;
    }

    const payload = {
        action: "/logout",
        data: {
            browser: "종료",
            studentEmail: userEmail,
            status: "inactive",
            room: "no room",
        }
    };

    console.log("브라우저 종료 이벤트 실행", payload);

    const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json'
    });

    try {
        const {data} = await api.post("/api/student-status", payload);
        return data;
    } catch (error) {
        throw error;
    }
    return success;
}

export const useStudentStatus = (user, page) => {
    console.log("useStudentStatus 훅 실행");

    const sendStatus = useCallback(async () => {
        return sendStudentStatus(user?.email, user?.tutorEmail, page?.pathname || page);
    }, [user?.email, user?.tutorEmail, page]);

    useEffect(() => {
        sendStatus();
    }, [sendStatus]);

    // 브라우저 종료 또는 탭 닫기 감지
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (user?.email) {
                sendStudentStatusSync(user.email, user.tutorEmail);
            }
        };

        const handleVisibilityChange = () => {
            if (user?.email) {
                if (document.visibilityState === 'hidden') {
                    // 탭을 떠날 때 - inactive
                    sendStudentStatusSync(user.email, user.tutorEmail);
                } else if (document.visibilityState === 'visible') {
                    // 탭으로 돌아올 때 - active
                    sendStudentStatus(user.email, user.tutorEmail, page?.pathname || page);
                }else{

                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.email, user?.tutorEmail]);

    return {sendStatus};
}
export const sendStudentStatusBeacon = (userEmail, tutorEmail) => {
    if (!userEmail) return;

    const url = "/api/student-status";
    const payload = JSON.stringify({
        action: "/logout",
        data: {
            browser: "종료",
            studentEmail: userEmail,
            status: "inactive",
            room: "no room",
        }
    });

    // Blob 형식을 사용하여 전송 (CORS 이슈 방지를 위해 type 설정)
    const blob = new Blob([payload], { type: 'application/json' });

    // Beacon은 브라우저가 종료되어도 백그라운드에서 전송을 완료합니다.
    navigator.sendBeacon(url, blob);
};