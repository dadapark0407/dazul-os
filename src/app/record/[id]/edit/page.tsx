"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type VisitRecord = {
  id: string;
  visit_date: string;
  pet_name: string;
  guardian_name: string;
  staff_name: string;
  service: string;
  note: string;
};

const staffOptions = ["소영", "직원1", "직원2", "직원3", "직원4"];
const serviceOptions = ["목욕", "부분미용", "전체미용", "스파", "팩", "스파+팩"];

const noteTemplates: Record<string, string> = {
  목욕: `목욕 진행
피부 상태:
특이사항:
다음 방문 추천:`,
  부분미용: `부분미용 진행
정리 부위:
아이 반응:
특이사항:`,
  전체미용: `전체미용 진행
스타일:
길이:
아이 반응:
특이사항:`,
  스파: `스파 진행
사용 제품:
피부/모질 상태:
아이 반응:
다음 추천:`,
  팩: `팩 진행
사용 제품:
피부 상태:
아이 반응:
다음 추천:`,
  "스파+팩": `스파+팩 진행
사용 제품:
피부/모질 상태:
아이 반응:
다음 추천:`,
};

export default function EditRecordPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [visitDate, setVisitDate] = useState("");
  const [petName, setPetName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [service, setService] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("visit_records")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setErrorMessage("수정할 기록을 불러오지 못했어요.");
        setLoading(false);
        return;
      }

      setVisitDate(data.visit_date ?? "");
      setPetName(data.pet_name ?? "");
      setGuardianName(data.guardian_name ?? "");
      setStaffName(data.staff_name ?? "");
      setService(data.service ?? "");
      setNote(data.note ?? "");
      setLoading(false);
    };

    fetchRecord();
  }, [id]);

  const handleApplyTemplate = () => {
    if (!service) {
      alert("먼저 서비스를 선택해주세요.");
      return;
    }

    const template = noteTemplates[service];
    if (!template) return;

    const ok = confirm("현재 노트를 템플릿으로 바꿀까요?");
    if (!ok) return;

    setNote(template);
  };

  const handleUpdate = async () => {
    if (!visitDate || !petName || !guardianName || !staffName || !service) {
      alert("방문일, 반려견 이름, 보호자 이름, 담당자, 서비스를 모두 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("visit_records")
      .update({
        visit_date: visitDate,
        pet_name: petName,
        guardian_name: guardianName,
        staff_name: staffName,
        service,
        note,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      setErrorMessage(`수정 중 오류가 발생했어요: ${error.message}`);
      return;
    }

    alert("수정이 완료되었어요.");
    router.push(`/record/${id}`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">방문 기록 수정</h1>
        <p>불러오는 중...</p>
      </main>
    );
  }

  if (errorMessage && !visitDate && !petName) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">방문 기록 수정</h1>
        <p className="text-red-500 mb-4">{errorMessage}</p>
        <button
          onClick={() => router.push("/record")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          목록으로 돌아가기
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">방문 기록 수정</h1>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">방문일</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">반려견 이름</label>
          <input
            type="text"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            placeholder="예: 테디"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">보호자 이름</label>
          <input
            type="text"
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            placeholder="예: 김소영"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">담당자</label>
          <div className="flex flex-wrap gap-2">
            {staffOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStaffName(item)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  staffName === item ? "bg-black text-white" : "bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">선택된 담당자: {staffName || "-"}</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">서비스</label>
          <div className="flex flex-wrap gap-2">
            {serviceOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setService(item)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  service === item ? "bg-black text-white" : "bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">선택된 서비스: {service || "-"}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium">노트</label>
            <button
              type="button"
              onClick={handleApplyTemplate}
              className="rounded border px-3 py-1 text-sm"
            >
              템플릿 적용
            </button>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={12}
            placeholder="노트를 입력해주세요."
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/record/${id}`)}
            className="rounded border px-4 py-2"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "수정 중..." : "수정 저장"}
          </button>
        </div>
      </div>
    </main>
  );
}
