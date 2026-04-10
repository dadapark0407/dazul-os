"use client";

import Link from "next/link";
import { useState } from "react";

const SERVICE_OPTIONS = ["목욕", "미용", "목욕 + 미용", "발톱", "귀 청소", "치아 케어"];
const SKIN_OPTIONS = ["양호", "건조", "민감", "염증", "기타"];

export default function NewRecordPage() {
  const [name, setName] = useState("");
  const [service, setService] = useState<string[]>([]);
  const [skin, setSkin] = useState("");
  const [careMemo, setCareMemo] = useState("");
  const [nextRecommend, setNextRecommend] = useState("");

  function toggleService(option: string) {
    setService((prev) =>
      prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]
    );
  }

  function handleSave() {
    // TODO: 저장 로직 연결
    alert("저장되었습니다.");
  }

  return (
    <main className="flex flex-col flex-1 min-h-screen bg-amber-50">
      {/* 상단 헤더 */}
      <header className="flex items-center gap-3 px-5 py-4 bg-white border-b border-stone-200">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-50 hover:bg-amber-100 active:bg-amber-200 transition-colors text-stone-600 text-lg"
          aria-label="홈으로"
        >
          ←
        </Link>
        <h1 className="text-lg font-bold text-stone-800">방문 기록 작성</h1>
      </header>

      {/* 폼 */}
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">

        {/* 아이 이름 */}
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-600">아이 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-4 text-lg text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </section>

        {/* 서비스 종류 */}
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-600">서비스 종류</label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleService(option)}
                className={`rounded-full px-5 py-3 text-base font-medium transition-colors ${
                  service.includes(option)
                    ? "bg-amber-600 text-white"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-amber-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* 피부 상태 */}
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-600">피부 상태</label>
          <div className="flex flex-wrap gap-2">
            {SKIN_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSkin(option)}
                className={`rounded-full px-5 py-3 text-base font-medium transition-colors ${
                  skin === option
                    ? "bg-amber-600 text-white"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-amber-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        {/* 오늘 케어 메모 */}
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-600">오늘 케어 메모</label>
          <textarea
            value={careMemo}
            onChange={(e) => setCareMemo(e.target.value)}
            placeholder="오늘 케어 내용을 간단히 적어주세요"
            rows={3}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-4 text-base text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </section>

        {/* 다음 추천 */}
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-600">다음 추천</label>
          <textarea
            value={nextRecommend}
            onChange={(e) => setNextRecommend(e.target.value)}
            placeholder="다음 방문 시 추천 사항을 적어주세요"
            rows={3}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-4 text-base text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </section>
      </div>

      {/* 저장 버튼 */}
      <div className="px-5 py-4 bg-white border-t border-stone-200">
        <button
          type="button"
          onClick={handleSave}
          className="w-full max-w-2xl mx-auto flex items-center justify-center rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xl font-bold py-5 shadow-md transition-colors"
        >
          저장
        </button>
      </div>
    </main>
  );
}
