import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CopyTextButton from "@/components/CopyTextButton";
import {
  analyzePet,
  getRoutineBadgeLabel,
} from "@/lib/wellness";

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
  guardian_id: string | null;
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

function getConcernLevel(score: number) {
  if (score >= 6) return "높음";
  if (score >= 3) return "보통";
  return "낮음";
}

export default async function PetHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("*")
    .eq("id", id)
    .single<Pet>();

  if (petError || !pet) {
    notFound();
  }

  let guardian: Guardian | null = null;

  if (pet.guardian_id) {
    const { data: guardianData } = await supabase
      .from("guardians")
      .select("*")
      .eq("id", pet.guardian_id)
      .single<Guardian>();

    guardian = guardianData ?? null;
  }

  const { data: visitRecordsData, error: recordsError } = await supabase
    .from("visit_records")
    .select("*")
    .eq("pet_id", pet.id)
    .order("visit_date", { ascending: false });

  if (recordsError) {
    throw new Error("방문 기록을 불러오지 못했습니다.");
  }

  const records = ensureArray(visitRecordsData as VisitRecord[]);
  const analysis = analyzePet(pet, records);

  const counselorMessage = [
    `${pet.name ?? "이 아이"} 브리핑입니다.`,
    `누적 방문은 ${analysis.visitCount}회이며 최근 90일 방문은 ${analysis.recent90Count}회입니다.`,
    analysis.cycleStats?.averageDays
      ? `평균 방문 주기는 ${analysis.cycleStats.averageDays}일입니다.`
      : `방문 주기는 아직 더 기록이 필요합니다.`,
    analysis.routineStats?.routineType
      ? `현재 패턴은 ${getRoutineBadgeLabel(analysis.routineStats.routineType)}으로 해석됩니다.`
      : `루틴 판정 데이터는 아직 충분하지 않습니다.`,
    `최근 상태 관심도는 ${analysis.concernScore}점(${getConcernLevel(analysis.concernScore)})입니다.`,
    analysis.latestRecord?.special_notes
      ? `특이사항: ${analysis.latestRecord.special_notes}`
      : `기록된 특이사항은 없습니다.`,
  ].join(" ");

  const customerMessage = [
    `안녕하세요 🤍`,
    `${pet.name ?? "아이"}의 최근 기록을 기준으로 정리해드릴게요.`,
    "",
    `현재 누적 방문은 ${analysis.visitCount}회이고`,
    analysis.cycleStats?.averageDays
      ? `평균 방문 주기는 약 ${analysis.cycleStats.averageDays}일 정도로 보여요.`
      : `방문 주기는 아직 조금 더 기록이 쌓이면 더 정확하게 볼 수 있어요.`,
    "",
    analysis.routineStats?.routineType
      ? `현재는 ${getRoutineBadgeLabel(analysis.routineStats.routineType)} 흐름으로 보입니다.`
      : `아직 정기 루틴은 더 지켜보면 좋을 것 같아요.`,
    "",
    analysis.concernScore >= 3
      ? `최근 기록상 피부, 모질, 컨디션, 긴장도 중 조금 더 세심하게 보면 좋은 포인트가 있어 함께 관리해드리면 좋겠습니다.`
      : `최근 기록상 큰 무리 없이 비교적 안정적인 흐름으로 보입니다.`,
    "",
    `앞으로도 ${pet.name ?? "아이"}의 컨디션과 피부, 모질 상태를 함께 보면서 무리하지 않는 방향으로 관리 도와드릴게요 🤍`,
  ].join("\n");

  const vipReportMessage = [
    `【 ${pet.name ?? "반려견"} VIP 웰니스 요약 】`,
    "",
    `1. 기본 정보`,
    `- 이름: ${pet.name ?? "-"}`,
    `- 품종: ${pet.breed ?? "-"}`,
    `- 보호자: ${guardian?.name ?? "-"}`,
    `- 최근 방문일: ${formatDate(analysis.latestVisitDate)}`,
    "",
    `2. 방문 흐름`,
    `- 누적 방문: ${analysis.visitCount}회`,
    `- 최근 90일 방문: ${analysis.recent90Count}회`,
    analysis.cycleStats?.averageDays
      ? `- 평균 방문 주기: ${analysis.cycleStats.averageDays}일`
      : `- 평균 방문 주기: 데이터 부족`,
    analysis.routineStats?.routineType
      ? `- 루틴 판정: ${getRoutineBadgeLabel(analysis.routineStats.routineType)}`
      : `- 루틴 판정: 데이터 부족`,
    "",
    `3. 최근 상태`,
    `- 피부: ${analysis.latestRecord?.skin_status ?? "-"}`,
    `- 모질: ${analysis.latestRecord?.coat_status ?? "-"}`,
    `- 컨디션: ${analysis.latestRecord?.condition_status ?? "-"}`,
    `- 스트레스: ${analysis.latestRecord?.stress_status ?? "-"}`,
    "",
    `4. 자동 해석`,
    `${analysis.visitSummary}`,
    `${analysis.flowSummary}`,
    `${analysis.autoRecommendation}`,
    `${analysis.revisitRecommendation}`,
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

        {guardian?.id ? (
          <Link
            href={`/guardian/${guardian.id}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            보호자 페이지 보기
          </Link>
        ) : null}

        <Link
          href={`/record/new?petId=${pet.id}${guardian?.id ? `&guardianId=${guardian.id}` : ""}`}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + 새 방문 기록 작성
        </Link>
      </div>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-500">반려견 통합 페이지</p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {pet.name ?? "이름 없음"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {joinNonEmpty([
                pet.breed,
                pet.gender,
                pet.birth_date ? `생일 ${formatDate(pet.birth_date)}` : null,
                pet.weight ? `${pet.weight}kg` : null,
              ]) || "기본 정보가 아직 충분하지 않습니다."}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              보호자: {guardian?.name ?? "-"} / 연락처: {formatPhone(guardian?.phone)}
            </p>
            {pet.memo ? (
              <p className="mt-2 text-sm leading-6 text-gray-600">{pet.memo}</p>
            ) : null}
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">누적 방문</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{analysis.visitCount}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">최근 90일 방문</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{analysis.recent90Count}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">평균 방문 주기</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {analysis.cycleStats?.averageDays ? `${analysis.cycleStats.averageDays}일` : "-"}
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-gray-500">루틴 판정</div>
              <div className="mt-2 text-lg font-bold text-gray-900">
                {getRoutineBadgeLabel(analysis.routineStats?.routineType)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-700">현재 해석</p>
          <p className="mt-2 text-sm leading-7 text-stone-700">{analysis.visitSummary}</p>
          <p className="mt-2 text-sm leading-7 text-stone-600">{analysis.flowSummary}</p>
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
          <h2 className="text-xl font-bold text-gray-900">방문 분석</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-gray-700">
            <p>{analysis.visitSummary}</p>
            <p>{analysis.flowSummary}</p>
            <p>{analysis.autoRecommendation}</p>
            <p>{analysis.revisitRecommendation}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">관리 포인트</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
            <p>
              • 최근 방문일:{" "}
              <span className="font-semibold">
                {formatDate(analysis.latestVisitDate)}
                {typeof analysis.daysFromLatest === "number"
                  ? ` (${analysis.daysFromLatest}일 전)`
                  : ""}
              </span>
            </p>
            <p>
              • 평균 방문 주기:{" "}
              <span className="font-semibold">
                {analysis.cycleStats?.averageDays
                  ? `${analysis.cycleStats.averageDays}일`
                  : "-"}
              </span>
            </p>
            <p>
              • 루틴 판정:{" "}
              <span className="font-semibold">
                {getRoutineBadgeLabel(analysis.routineStats?.routineType)}
              </span>
            </p>
            <p>
              • 최근 상태 관심도:{" "}
              <span className="font-semibold">
                {analysis.concernScore}점 / {getConcernLevel(analysis.concernScore)}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">최근 기록 핵심 상태</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-xs text-gray-500">피부</div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {analysis.latestRecord?.skin_status ?? "-"}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-xs text-gray-500">모질</div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {analysis.latestRecord?.coat_status ?? "-"}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-xs text-gray-500">컨디션</div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {analysis.latestRecord?.condition_status ?? "-"}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-xs text-gray-500">스트레스</div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {analysis.latestRecord?.stress_status ?? "-"}
            </div>
          </div>
        </div>

        {(analysis.latestRecord?.special_notes ||
          analysis.latestRecord?.next_visit_recommendation) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs text-gray-500">특이사항</div>
              <div className="mt-2 whitespace-pre-line text-sm text-gray-800">
                {analysis.latestRecord?.special_notes ?? "-"}
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs text-gray-500">다음 방문 제안</div>
              <div className="mt-2 whitespace-pre-line text-sm text-gray-800">
                {analysis.latestRecord?.next_visit_recommendation ?? "-"}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">방문 기록 타임라인</h2>
          <span className="text-sm text-gray-500">최신순</span>
        </div>

        {records.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            아직 방문 기록이 없습니다.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {records.map((record) => (
              <article
                key={record.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      방문일 {formatDate(record.visit_date)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      서비스: {record.service_type ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">피부</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {record.skin_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">모질</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {record.coat_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">컨디션</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {record.condition_status ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">스트레스</div>
                    <div className="mt-1 text-sm text-gray-900">
                      {record.stress_status ?? "-"}
                    </div>
                  </div>
                </div>

                {(record.special_notes || record.next_visit_recommendation) && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-stone-50 p-3">
                      <div className="text-xs text-gray-500">특이사항</div>
                      <div className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {record.special_notes ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-stone-50 p-3">
                      <div className="text-xs text-gray-500">다음 방문 제안</div>
                      <div className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {record.next_visit_recommendation ?? "-"}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}