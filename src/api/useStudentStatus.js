import {useCallback, useEffect} from "react";
import api from "./axios";

// 훅과 별도로 상태 전송 함수 export
export const sendStudentStatus = async (userEmail, tutorEmail, page) => {
    if (!userEmail) {
        console.log("⚠️ userEmail이 없어서 상태 업데이트를 건너뜁니다.");
        return null;
    }

    if (!tutorEmail) {
        console.log("⚠️ tutorEmail이 없어서 상태 업데이트를 건너뜁니다. (튜터 미등록 학생)");
        return null;
    }

    const payload = {
        action: page === "/logout" ? "logout" : page,
        data: {
            studentEmail: userEmail,
            tutorEmail: tutorEmail,
            status: page === "/logout" ? "inactive" : "active",
            room: page === "/chat" ? "ai chat" : page === "/practice" ? "sentence" : "no room",
        }
    }

    // 상태 매핑
    const getStatusText = (status, room) => {
        if (status === "inactive") return "🔴 오프라인";
        if (room === "ai") return "🟢 AI대화중";
        if (room === "sentence") return "🟢 문장연습중";
        return "🟡 온라인";
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📍 학생 상태 업데이트: ${getStatusText(payload.data.status, payload.data.room)}`);
    console.log(`👤 학생: ${userEmail}`);
    console.log(`📄 페이지: ${page}`);
    console.log(`📦 전송 데이터:`, payload);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        const {data} = await api.post("/api/student-status", payload);
        console.log("✅ 상태 업데이트 성공:", data);
        return data;
    } catch (error) {
        console.error("❌ 상태 업데이트 실패:", error);
        throw error;
    }
};

export const sendStudentStatusSync = async (userEmail, tutorEmail) => {
    if (!userEmail) {
        console.log("⚠️ userEmail이 없어서 오프라인 상태 업데이트를 건너뜁니다.");
        return null;
    }

    if (!tutorEmail) {
        console.log("⚠️ tutorEmail이 없어서 오프라인 상태 업데이트를 건너뜁니다. (튜터 미등록 학생)");
        return null;
    }

    const payload = {
        action: "/logout",
        data: {
            browser: "종료",
            studentEmail: userEmail,
            tutorEmail: tutorEmail,
            status: "inactive",
            room: "no room",
        }
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔴 브라우저 종료/탭 전환 → 오프라인 상태로 변경");
    console.log(`👤 학생: ${userEmail}`);
    console.log(`📦 전송 데이터:`, payload);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        const {data} = await api.post("/api/student-status", payload);
        console.log("✅ 오프라인 상태 업데이트 완료");
        return data;
    } catch (error) {
        console.error("❌ 오프라인 상태 업데이트 실패:", error);
        throw error;
    }   
}

export const useStudentStatus = (user, page) => {
    const currentPage = page?.pathname || page;
    const userEmail = user?.email;
    const tutorEmail = user?.tutorEmail;

    const sendStatus = useCallback(async () => {
        console.log(`🔄 useStudentStatus 상태 전송 실행 | 학생: ${userEmail} | 페이지: ${currentPage}`);
        return sendStudentStatus(userEmail, tutorEmail, currentPage);
    }, [userEmail, tutorEmail, currentPage]);

    useEffect(() => {
        console.log(`✅ useEffect 트리거 | 학생: ${userEmail} | 페이지: ${currentPage}`);
        sendStatus();
    }, [sendStatus, userEmail, currentPage]);

    // 브라우저 종료 감지
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (userEmail) {
                console.log("🚪 브라우저 종료 감지 → 오프라인 처리");
                sendStudentStatusSync(userEmail, tutorEmail);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [userEmail, tutorEmail]);

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

    console.log("📡 Beacon API로 오프라인 전송 (브라우저 종료)");
    console.log(`👤 학생: ${userEmail}`);

    // Blob 형식을 사용하여 전송 (CORS 이슈 방지를 위해 type 설정)
    const blob = new Blob([payload], { type: 'application/json' });

    // Beacon은 브라우저가 종료되어도 백그라운드에서 전송을 완료합니다.
    navigator.sendBeacon(url, blob);
};