import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  analyzeGuardianFamily,
  getRoutineBadgeLabel,
} from "@/lib/wellness";
import CopyTextButton from "@/components/CopyTextButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Guardian = {
  id: string;
  name: string | null;
  phone: string | null;
  memo?: string | null;
};

type Pet = {
  id: string;
  guardian_id: string;
  name: string | null;
  breed?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  weight?: number | null;
  memo?: string | null;
};

type VisitRecord = {
  id: string;
  pet_id: string;
  visit_date: string | null;
  service_type?: string | null;
  skin_status?: string | null;
  coat_status?: string | null;
  condition_status?: string | null;
  stress_status?: string | null;
  special_notes?: string | null;
  next_visit_recommendation?: string | null;
  created_at?: string | null;
};

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  return phone;
}

function joinNonEmpty(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" · ");
}

export default async function GuardianHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("*")
    .eq("id", id)
    .single<Guardian>();

  if (guardianError || !guardian) {
    notFound();
  }

  const { data: petsData, error: petsError } = await supabase
    .from("pets")
    .select("*")
    .eq("guardian_id", guardian.id)
    .order("name", { ascending: true });

  if (petsError) {
    throw new Error("반려견 정보를 불러오지 못했습니다.");
  }

  const pets = ensureArray(petsData as Pet[]);
  const petIds = pets.map((pet) => pet.id);

  let allRecords: VisitRecord[] = [];

  if (petIds.length > 0) {
    const { data: visitRecordsData, error: recordsError } = await supabase
      .from("visit_records")
      .select("*")
      .in("pet_id", petIds)
      .order("visit_date", { ascending: false });

    if (recordsError) {
      throw new Error("방문 기록을 불러오지 못했습니다.");
    }

    allRecords = ensureArray(visitRecordsData as VisitRecord[]);
  }

  const family = analyzeGuardianFamily(guardian.name ?? "보호자", pets, allRecords);

  const topAttentionPets = family.petAnalyses
    .filter((item) => item.concernScore >= 3)
    .slice(0, 2)
    .map((item) => item.pet.name ?? "이름 없음");

  const regularPetNames = family.petAnalyses
    .filter((item) => {
      const label = item.routineStats?.routineType ?? "";
      return (
        label.includes("1주") ||
        label.includes("2주") ||
        label.includes("3주") ||
        label.includes("4주")
      );
    })
    .slice(0, 3)
    .map((item) => item.pet.name ?? "이름 없음");

  const counselorMessage = [
    `${guardian.name ?? "보호자"}님 가정 기준 통합 브리핑입니다.`,
    `현재 등록 반려견은 총 ${family.petsCount}마리이고 누적 방문 기록은 ${family.totalVisits}건입니다.`,
    family.regularPets > 0
      ? `정기 루틴이 형성된 아이는 ${family.regularPets}마리로, ${regularPetNames.join(", ") || "일부 아이"} 중심으로 비교적 안정적인 관리 흐름이 보입니다.`
      : `아직 정기 루틴이 뚜렷하지 않아 방문 주기 정리가 필요합니다.`,
    family.needsAttentionCount > 0
      ? `최근 상태상 조금 더 세심하게 봐야 할 아이는 ${topAttentionPets.join(", ")} 입니다.`
      : `최근 기록상 급한 우려 포인트는 크지 않습니다.`,
    family.longestGapPetName
      ? `방문 공백이 가장 긴 아이는 ${family.longestGapPetName}이며 ${family.longestGapDays}일 경과했습니다.`
      : `방문 공백 분석은 아직 충분한 기록이 없습니다.`,
  ].join(" ");

  const customerMessage = [
    `안녕하세요, ${guardian.name ?? "보호자"}님 🤍`,
    "",
    `현재 아이들 전체 방문 기록을 기준으로 보면`,
    `총 ${family.petsCount}마리의 관리 데이터가 누적되어 있고`,
    `누적 방문은 ${family.totalVisits}회입니다.`,
    "",
    family.regularPets > 0
      ? `정기적으로 흐름이 잘 잡혀 있는 아이들도 있어 전반적인 관리 루틴은 비교적 안정적인 편이에요.`
      : `아직 방문 주기가 일정하게 잡히지 않은 아이들이 있어 루틴을 같이 맞춰가면 더 좋을 것 같아요.`,
    "",
    family.needsAttentionCount > 0
      ? `최근 기록상 조금 더 세심하게 보면 좋을 아이는 ${topAttentionPets.join(", ")} 쪽이에요.`
      : `최근 기록상 크게 우려되는 부분은 보이지 않았어요.`,
    "",
    `앞으로도 각 아이 컨디션과 피부, 모질, 긴장도까지 함께 보면서 무리하지 않는 방향으로 관리 도와드릴게요 🤍`,
  ].join("\n");

  const vipReportMessage = [
    `【 ${guardian.name ?? "보호자"}님 가정 VIP 웰니스 요약 】`,
    "",
    `1. 가정 전체 현황`,
    `- 등록 반려견: ${family.petsCount}마리`,
    `- 누적 방문: ${family.totalVisits}건`,
    `- 최근 90일 방문: ${family.recent90Visits}건`,
    `- 기록 보유 아이: ${family.petsWithRecords}마리`,
    "",
    `2. 루틴 분석`,
    `- 정기 루틴 아이: ${family.regularPets}마리`,
    `- 혼합/불규칙 아이: ${family.irregularPets}마리`,
    family.longestGapPetName
      ? `- 가장 긴 방문 공백: ${family.longestGapPetName} / ${family.longestGapDays}일`
      : `- 방문 공백 분석: 데이터 부족`,
    "",
    `3. 케어 포인트`,
    family.needsAttentionCount > 0
      ? `- 최근 상태 주의 필요: ${topAttentionPets.join(", ")}`
      : `- 최근 상태상 급한 우려 포인트는 크지 않음`,
    "",
    `4. 총평`,
    `${family.summaryText}`,
    `${family.overallTone}`,
  ].join("\n");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/record"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← 방문 기록 목록
        </Link>

        <Link
          href={`/record/new?guardianId=${guardian.id}`}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + 새 방문 기록 작성
        </Link>
      </div>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-500">보호자 통합 페이지</p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {guardian.name ?? "이름 없음"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              연락처: {formatPhone(guardian.phone)}
            </p>
            {guardian.memo ? (
              <p className="mt-2 text-sm leading-6 text-gray-600">{guardian.memo}</p>
            ) : null}
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">등록 반려견</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{family.petsCount}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">누적 방문</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{family.totalVisits}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">최근 90일 방문</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{family.recent90Visits}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">정기 루틴 아이</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{family.regularPets}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-700">가정 전체 해석</p>
          <p className="mt-2 text-sm leading-7 text-stone-700">{family.summaryText}</p>
          <p className="mt-2 text-sm leading-7 text-stone-600">{family.overallTone}</p>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">상담용 멘트</h2>
            <CopyTextButton text={counselorMessage} label="복사" />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">
            {counselorMessage}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">보호자 전달용 멘트</h2>
            <CopyTextButton text={customerMessage} label="복사" />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">
            {customerMessage}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">VIP 리포트용 멘트</h2>
            <CopyTextButton text={vipReportMessage} label="복사" />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">
            {vipReportMessage}
          </p>
        </div>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">상담용 한줄 브리핑</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">
            {family.quickCounselScript}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">관리 포인트</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
            <p>
              • 정기 루틴 아이: <span className="font-semibold">{family.regularPets}마리</span>
            </p>
            <p>
              • 혼합/불규칙 아이: <span className="font-semibold">{family.irregularPets}마리</span>
            </p>
            <p>
              • 최근 상태 주의 필요:{" "}
              <span className="font-semibold">{family.needsAttentionCount}마리</span>
            </p>
            <p>
              • 가장 오래 방문 공백이 있는 아이:{" "}
              <span className="font-semibold">
                {family.longestGapPetName
                  ? `${family.longestGapPetName} (${family.longestGapDays}일)`
                  : "-"}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">아이별 빠른 비교</h2>

        {family.petAnalyses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">등록된 반려견이 없습니다.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-3 font-semibold">이름</th>
                  <th className="px-3 py-3 font-semibold">품종</th>
                  <th className="px-3 py-3 font-semibold">누적 방문</th>
                  <th className="px-3 py-3 font-semibold">최근 방문</th>
                  <th className="px-3 py-3 font-semibold">평균 주기</th>
                  <th className="px-3 py-3 font-semibold">루틴</th>
                  <th className="px-3 py-3 font-semibold">최근 상태</th>
                </tr>
              </thead>
              <tbody>
                {family.petAnalyses.map((item) => (
                  <tr key={item.pet.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-4 font-semibold text-gray-900">
                      <Link
                        href={`/pet/${item.pet.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {item.pet.name ?? "-"}
                      </Link>
                    </td>
                    <td className="px-3 py-4 text-gray-700">{item.pet.breed ?? "-"}</td>
                    <td className="px-3 py-4 text-gray-700">{item.visitCount}</td>
                    <td className="px-3 py-4 text-gray-700">
                      {formatDate(item.latestVisitDate)}
                      {typeof item.daysFromLatest === "number" ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {item.daysFromLatest}일 전
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-gray-700">
                      {item.cycleStats?.averageDays
                        ? `${item.cycleStats.averageDays}일`
                        : "-"}
                    </td>
                    <td className="px-3 py-4 text-gray-700">
                      {getRoutineBadgeLabel(item.routineStats?.routineType)}
                    </td>
                    <td className="px-3 py-4 text-gray-700">
                      {joinNonEmpty([
                        item.latestRecord?.skin_status,
                        item.latestRecord?.coat_status,
                        item.latestRecord?.condition_status,
                        item.latestRecord?.stress_status,
                      ]) || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">아이별 통합 분석</h2>

        {family.petAnalyses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            아직 등록된 반려견이 없습니다.
          </div>
        ) : (
          family.petAnalyses.map((item) => (
            <article
              key={item.pet.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {item.pet.name ?? "이름 없음"}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {item.pet.breed ?? "품종 미입력"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      방문 {item.visitCount}회
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {getRoutineBadgeLabel(item.routineStats?.routineType)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-gray-600">
                    {joinNonEmpty([
                      item.pet.gender,
                      item.pet.birth_date ? `생일 ${formatDate(item.pet.birth_date)}` : null,
                      item.pet.weight ? `${item.pet.weight}kg` : null,
                    ]) || "기본 정보가 아직 충분하지 않습니다."}
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    최근 방문일: {formatDate(item.latestVisitDate)}
                    {typeof item.daysFromLatest === "number"
                      ? ` (${item.daysFromLatest}일 전)`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/pet/${item.pet.id}`}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    반려견 상세 보기
                  </Link>
                  <Link
                    href={`/record/new?guardianId=${guardian.id}&petId=${item.pet.id}`}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    이 아이 기록 작성
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">평균 방문 주기</div>
                  <div className="mt-2 text-lg font-bold text-gray-900">
                    {item.cycleStats?.averageDays ? `${item.cycleStats.averageDays}일` : "-"}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">최근 90일 방문</div>
                  <div className="mt-2 text-lg font-bold text-gray-900">
                    {item.recent90Count}회
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">최근 상태 관심도</div>
                  <div className="mt-2 text-lg font-bold text-gray-900">
                    {item.concernScore}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">주기 판정</div>
                  <div className="mt-2 text-lg font-bold text-gray-900">
                    {getRoutineBadgeLabel(item.routineStats?.routineType)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">방문 요약</h4>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-700">
                    {item.visitSummary}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">변화 흐름 분석</h4>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-700">
                    {item.flowSummary}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">자동 케어 추천</h4>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-700">
                    {item.autoRecommendation}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">재방문 추천</h4>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-700">
                    {item.revisitRecommendation}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-stone-50 p-4">
                <h4 className="text-sm font-semibold text-stone-800">최근 기록 핵심 상태</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">피부</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {item.latestRecord?.skin_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">모질</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {item.latestRecord?.coat_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">컨디션</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {item.latestRecord?.condition_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">스트레스</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {item.latestRecord?.stress_status ?? "-"}
                    </div>
                  </div>
                </div>

                {(item.latestRecord?.special_notes ||
                  item.latestRecord?.next_visit_recommendation) && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-xs text-gray-500">특이사항</div>
                      <div className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {item.latestRecord?.special_notes ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-xs text-gray-500">다음 방문 제안</div>
                      <div className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {item.latestRecord?.next_visit_recommendation ?? "-"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}