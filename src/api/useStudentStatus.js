import {useCallback, useEffect, useRef} from "react";
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

    console.log('[sendStudentStatus] payload:', payload);

    try {
        const {data} = await api.post("https://vaf6in8xz0.execute-api.ap-northeast-2.amazonaws.com/Dev/api/student-status", payload);
        return data;
    } catch (error) {
        console.error('[sendStudentStatus] error:', error);
        throw error;
    }
};

export const sendStudentStatusSync = async (userEmail, tutorEmail, pathname) => {
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

    console.log("[sendStudentStatusSync] payload:", payload);

    try {
        const {data} = await api.post("https://vaf6in8xz0.execute-api.ap-northeast-2.amazonaws.com/Dev/api/student-status", payload);
        return data;
    } catch (error) {
        console.error('[sendStudentStatusSync] error:', error);
        throw error;
    }
}

export const useStudentStatus = (user, pathname) => {
    // pathname이 문자열인지 확인하고, 아니면 추출
    const currentPath = typeof pathname === 'string' ? pathname : pathname?.pathname || '/';

    // 중복 호출 방지를 위한 ref
    const lastSentPathRef = useRef(null);
    const isHiddenRef = useRef(false);
    const isMountedRef = useRef(false);

    // pathname 변경 시에만 상태 전송
    useEffect(() => {
        // 마운트 직후 첫 실행 또는 pathname이 실제로 변경된 경우만
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            lastSentPathRef.current = currentPath;

            if (user?.email) {
                console.log('[useStudentStatus] Initial mount, sending status for:', currentPath);
                sendStudentStatus(user.email, user.tutorEmail, currentPath);
            }
            return;
        }

        // pathname이 변경되지 않았으면 실행 안 함
        if (lastSentPathRef.current === currentPath) {
            return;
        }

        console.log('[useStudentStatus] Path changed:', lastSentPathRef.current, '->', currentPath);
        lastSentPathRef.current = currentPath;

        if (user?.email) {
            sendStudentStatus(user.email, user.tutorEmail, currentPath);
        }
    }, [currentPath, user?.email, user?.tutorEmail]);

    // 브라우저 종료 또는 탭 닫기 감지
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!user?.email) return;

            if (document.visibilityState === 'hidden' && !isHiddenRef.current) {
                isHiddenRef.current = true;
                console.log('[useStudentStatus] Tab hidden, sending logout');
                sendStudentStatusSync(user.email, user.tutorEmail, currentPath);
            }

            if (document.visibilityState === 'visible' && isHiddenRef.current) {
                isHiddenRef.current = false;
                console.log('[useStudentStatus] Tab visible, sending active status');
                sendStudentStatus(user.email, user.tutorEmail, currentPath);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.email, user?.tutorEmail, currentPath]);

    // 수동 호출용 함수 제공
    const sendStatus = useCallback(async () => {
        if (!user?.email) return null;
        return sendStudentStatus(user.email, user.tutorEmail, currentPath);
    }, [user?.email, user?.tutorEmail, currentPath]);

    return {sendStatus};
}