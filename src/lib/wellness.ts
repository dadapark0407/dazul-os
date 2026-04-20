export type VisitRecord = {
  id?: string;
  pet_id?: string | null;
  visit_date?: string | null;
  service_type?: string | null;
  skin_status?: string | null;
  coat_status?: string | null;
  condition_status?: string | null;
  stress_status?: string | null;
  special_notes?: string | null;
  next_visit_recommendation?: string | null;
  created_at?: string | null;
};

export type PetProfile = {
  id: string;
  guardian_id?: string | null;
  name?: string | null;
  breed?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  weight?: number | null;
  memo?: string | null;
};

export type PetAnalysis = {
  pet: PetProfile;
  records: VisitRecord[];
  latestRecord: VisitRecord | null;
  latestVisitDate: string | null;
  daysFromLatest: number | null;
  visitCount: number;
  recent90Count: number;
  visitSummary: string;
  flowSummary: string;
  autoRecommendation: string;
  revisitRecommendation: string;
  cycleStats: ReturnType<typeof getVisitCycleStats> | null;
  routineStats: ReturnType<typeof getVisitRoutineStats> | null;
  concernScore: number;
};

export type GuardianAnalysis = {
  petsCount: number;
  totalVisits: number;
  recent90Visits: number;
  petsWithRecords: number;
  regularPets: number;
  irregularPets: number;
  needsAttentionCount: number;
  longestGapPetName: string | null;
  longestGapDays: number | null;
  summaryText: string;
  overallTone: string;
  quickCounselScript: string;
  petAnalyses: PetAnalysis[];
};

export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function isValidDate(value?: string | null) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function sortRecordsByVisitDate(records: VisitRecord[]) {
  return ensureArray(records)
    .filter((record) => isValidDate(record.visit_date))
    .sort((a, b) => {
      return new Date(b.visit_date as string).getTime() - new Date(a.visit_date as string).getTime();
    });
}

export function getLatestRecord(records: VisitRecord[]) {
  const sorted = sortRecordsByVisitDate(records);
  return sorted[0] ?? null;
}

export function getLatestVisitDate(records: VisitRecord[]) {
  return getLatestRecord(records)?.visit_date ?? null;
}

export function getDaysFromToday(value?: string | null) {
  if (!isValidDate(value)) return null;

  const today = new Date();
  const target = new Date(value as string);

  const diff = today.getTime() - target.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getRecordsWithinDays(records: VisitRecord[], days: number) {
  const now = new Date();

  return ensureArray(records).filter((record) => {
    if (!isValidDate(record.visit_date)) return false;

    const visitDate = new Date(record.visit_date as string);
    const diff = now.getTime() - visitDate.getTime();
    const diffDays = diff / (1000 * 60 * 60 * 24);

    return diffDays <= days;
  });
}

export function extractStatusValues(records: VisitRecord[], key: keyof VisitRecord) {
  return sortRecordsByVisitDate(records)
    .map((record) => record[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function getMostCommonValue(values: string[]) {
  if (values.length === 0) return null;

  const counter = new Map<string, number>();

  for (const value of values) {
    counter.set(value, (counter.get(value) ?? 0) + 1);
  }

  let bestValue: string | null = null;
  let bestCount = 0;

  for (const [value, count] of counter.entries()) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }

  return bestValue;
}

export function buildVisitSummary(records: VisitRecord[]) {
  const sorted = sortRecordsByVisitDate(records);

  if (sorted.length === 0) {
    return "방문 요약 데이터가 아직 없습니다.";
  }

  const latest = sorted[0];

  const skinCommon = getMostCommonValue(extractStatusValues(sorted, "skin_status"));
  const coatCommon = getMostCommonValue(extractStatusValues(sorted, "coat_status"));
  const conditionCommon = getMostCommonValue(extractStatusValues(sorted, "condition_status"));
  const stressCommon = getMostCommonValue(extractStatusValues(sorted, "stress_status"));

  const parts = [
    `총 ${sorted.length}회의 방문 기록이 있습니다.`,
    skinCommon ? `피부 상태는 '${skinCommon}' 경향이 자주 보입니다.` : null,
    coatCommon ? `모질 상태는 '${coatCommon}' 흐름이 많습니다.` : null,
    conditionCommon ? `컨디션은 '${conditionCommon}' 쪽으로 기록되는 편입니다.` : null,
    stressCommon ? `스트레스 반응은 '${stressCommon}' 경향이 반복됩니다.` : null,
    latest.service_type ? `최근 서비스는 '${latest.service_type}' 입니다.` : null,
  ];

  return parts.filter(Boolean).join(" ");
}

export function buildFlowSummary(records: VisitRecord[]) {
  const sorted = sortRecordsByVisitDate(records);

  if (sorted.length < 2) {
    return "변화 흐름을 보기엔 기록이 더 필요합니다.";
  }

  const latest = sorted[0];
  const previous = sorted[1];

  const changes: string[] = [];

  if (latest.skin_status && previous.skin_status && latest.skin_status !== previous.skin_status) {
    changes.push(`피부 상태가 '${previous.skin_status}'에서 '${latest.skin_status}'로 변했습니다.`);
  }

  if (latest.coat_status && previous.coat_status && latest.coat_status !== previous.coat_status) {
    changes.push(`모질 상태가 '${previous.coat_status}'에서 '${latest.coat_status}'로 달라졌습니다.`);
  }

  if (
    latest.condition_status &&
    previous.condition_status &&
    latest.condition_status !== previous.condition_status
  ) {
    changes.push(`컨디션이 '${previous.condition_status}'에서 '${latest.condition_status}'로 변화했습니다.`);
  }

  if (latest.stress_status && previous.stress_status && latest.stress_status !== previous.stress_status) {
    changes.push(`스트레스 반응이 '${previous.stress_status}'에서 '${latest.stress_status}'로 바뀌었습니다.`);
  }

  if (changes.length === 0) {
    return "최근 두 번의 기록을 비교했을 때 큰 변화 없이 비슷한 흐름을 유지하고 있습니다.";
  }

  return changes.join(" ");
}

export function buildAutoRecommendation(records: VisitRecord[]) {
  const sorted = sortRecordsByVisitDate(records);

  if (sorted.length === 0) {
    return "기록이 누적되면 자동 케어 추천이 표시됩니다.";
  }

  const latest = sorted[0];
  const text = [
    latest.skin_status,
    latest.coat_status,
    latest.condition_status,
    latest.stress_status,
    latest.special_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const recommendations: string[] = [];

  if (containsAny(text, ["건조", "각질", "푸석", "민감"])) {
    recommendations.push("보습 중심 케어와 저자극 관리 흐름을 추천합니다.");
  }

  if (containsAny(text, ["엉킴", "털빠짐", "모질 저하", "푸석"])) {
    recommendations.push("모질 정리와 컨디셔닝 케어를 함께 보는 것이 좋습니다.");
  }

  if (containsAny(text, ["긴장", "스트레스", "예민", "불안"])) {
    recommendations.push("서두르지 않는 진행과 안정 중심의 케어 환경이 잘 맞습니다.");
  }

  if (containsAny(text, ["피로", "컨디션 저하", "예민"])) {
    recommendations.push("무리한 스타일보다 부담이 적은 관리 중심 접근을 권장합니다.");
  }

  if (recommendations.length === 0) {
    return "현재 기록 기준으로는 정기적인 기본 관리 루틴을 유지하는 것이 좋습니다.";
  }

  return recommendations.join(" ");
}

export function buildRevisitRecommendation(records: VisitRecord[]) {
  const cycle = getVisitCycleStats(records);
  const routine = getVisitRoutineStats(records);

  if (!cycle || cycle.averageDays === null) {
    return "방문 기록이 더 쌓이면 다음 방문 주기를 더 정확히 제안할 수 있습니다.";
  }

  if (routine.routineType.includes("1주")) {
    return "현재 패턴상 1주 전후 재방문 흐름이 잘 맞습니다.";
  }

  if (routine.routineType.includes("2주")) {
    return "현재 패턴상 2주 전후 재방문 루틴이 안정적입니다.";
  }

  if (routine.routineType.includes("3주")) {
    return "현재 패턴상 3주 전후 관리가 자연스러운 흐름입니다.";
  }

  if (routine.routineType.includes("4주")) {
    return "현재 패턴상 4주 전후 주기로 유지하는 것이 좋습니다.";
  }

  if (routine.routineType.includes("혼합")) {
    return `방문 주기가 섞여 있어 평균 ${cycle.averageDays}일 기준으로 다음 예약을 잡아보는 것이 좋습니다.`;
  }

  return `최근 기록 기준 평균 ${cycle.averageDays}일 주기로 재방문하는 흐름이 보입니다.`;
}

export function getVisitCycleStats(records: VisitRecord[]) {
  const sorted = sortRecordsByVisitDate(records);

  if (sorted.length < 2) {
    return {
      averageDays: null as number | null,
      intervals: [] as number[],
    };
  }

  const intervals: number[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = new Date(sorted[i].visit_date as string).getTime();
    const next = new Date(sorted[i + 1].visit_date as string).getTime();
    const diff = Math.round((current - next) / (1000 * 60 * 60 * 24));

    if (diff > 0) {
      intervals.push(diff);
    }
  }

  if (intervals.length === 0) {
    return {
      averageDays: null as number | null,
      intervals,
    };
  }

  const averageDays = Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);

  return {
    averageDays,
    intervals,
  };
}

export function getVisitRoutineStats(records: VisitRecord[]) {
  const cycle = getVisitCycleStats(records);
  const intervals = cycle.intervals;

  if (intervals.length === 0) {
    return {
      routineType: "판정 없음",
      counts: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
        other: 0,
      },
    };
  }

  const counts = {
    week1: 0,
    week2: 0,
    week3: 0,
    week4: 0,
    other: 0,
  };

  for (const days of intervals) {
    if (days >= 5 && days <= 9) {
      counts.week1 += 1;
    } else if (days >= 10 && days <= 17) {
      counts.week2 += 1;
    } else if (days >= 18 && days <= 24) {
      counts.week3 += 1;
    } else if (days >= 25 && days <= 38) {
      counts.week4 += 1;
    } else {
      counts.other += 1;
    }
  }

  const bucketEntries = [
    { label: "1주 루틴", value: counts.week1 },
    { label: "2주 루틴", value: counts.week2 },
    { label: "3주 루틴", value: counts.week3 },
    { label: "4주 루틴", value: counts.week4 },
  ];

  const nonZeroBuckets = bucketEntries.filter((item) => item.value > 0);

  let routineType = "불규칙";

  if (nonZeroBuckets.length === 1 && counts.other === 0) {
    routineType = nonZeroBuckets[0].label;
  } else if (nonZeroBuckets.length >= 2 || counts.other > 0) {
    const maxBucket = [...bucketEntries].sort((a, b) => b.value - a.value)[0];

    if (maxBucket.value >= Math.ceil(intervals.length * 0.6) && counts.other === 0) {
      routineType = maxBucket.label;
    } else if (nonZeroBuckets.length >= 1) {
      routineType = "혼합 루틴";
    } else {
      routineType = "불규칙";
    }
  }

  return {
    routineType,
    counts,
  };
}

export function getConcernScore(record: VisitRecord | null) {
  if (!record) return 0;

  const text = [
    record.skin_status,
    record.coat_status,
    record.condition_status,
    record.stress_status,
    record.special_notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;

  const highKeywords = [
    "예민",
    "붉",
    "가려",
    "각질",
    "트러블",
    "건조",
    "염증",
    "스트레스",
    "긴장",
    "불안",
    "컨디션 저하",
    "피부 자극",
    "엉킴 심함",
    "통증",
    "민감",
  ];

  const mediumKeywords = [
    "보통",
    "약간",
    "조금",
    "주의",
    "관리 필요",
    "피부",
    "모질",
    "정리 필요",
    "피로",
  ];

  for (const keyword of highKeywords) {
    if (text.includes(keyword)) score += 2;
  }

  for (const keyword of mediumKeywords) {
    if (text.includes(keyword)) score += 1;
  }

  return score;
}

export function getRoutineBadgeLabel(routineType?: string | null) {
  if (!routineType) return "판정 없음";

  if (routineType.includes("1주")) return "1주 루틴";
  if (routineType.includes("2주")) return "2주 루틴";
  if (routineType.includes("3주")) return "3주 루틴";
  if (routineType.includes("4주")) return "4주 루틴";
  if (routineType.includes("혼합")) return "혼합 루틴";
  if (routineType.includes("불규칙")) return "불규칙";

  return routineType;
}

export function getGuardianOverallTone(totalVisits: number, petsCount: number) {
  if (petsCount === 0) return "아직 등록된 반려견이 없습니다.";
  if (totalVisits === 0) return "방문 기록이 아직 없어 첫 기록부터 차곡차곡 쌓아갈 수 있습니다.";
  if (totalVisits < 5) {
    return "기초 데이터가 쌓이는 단계라 앞으로의 방문 흐름을 보면 더 정확한 패턴 분석이 가능합니다.";
  }

  return "누적 데이터가 어느 정도 쌓여 있어 보호자 단위의 상담 흐름을 만들 수 있는 상태입니다.";
}

export function analyzePet(pet: PetProfile, records: VisitRecord[]): PetAnalysis {
  const safeRecords = ensureArray(records);
  const latestRecord = getLatestRecord(safeRecords);
  const latestVisitDate = getLatestVisitDate(safeRecords);

  return {
    pet,
    records: safeRecords,
    latestRecord,
    latestVisitDate,
    daysFromLatest: getDaysFromToday(latestVisitDate),
    visitCount: safeRecords.length,
    recent90Count: getRecordsWithinDays(safeRecords, 90).length,
    visitSummary: buildVisitSummary(safeRecords),
    flowSummary: buildFlowSummary(safeRecords),
    autoRecommendation: buildAutoRecommendation(safeRecords),
    revisitRecommendation: buildRevisitRecommendation(safeRecords),
    cycleStats: safeRecords.length > 1 ? getVisitCycleStats(safeRecords) : null,
    routineStats: safeRecords.length > 1 ? getVisitRoutineStats(safeRecords) : null,
    concernScore: getConcernScore(latestRecord),
  };
}

export function analyzeGuardianFamily(guardianName: string, pets: PetProfile[], allRecords: VisitRecord[]): GuardianAnalysis {
  const safePets = ensureArray(pets);
  const safeRecords = ensureArray(allRecords);

  const petAnalyses = safePets.map((pet) => {
    const petRecords = safeRecords.filter((record) => record.pet_id === pet.id);
    return analyzePet(pet, petRecords);
  });

  const totalVisits = safeRecords.length;
  const recent90Visits = getRecordsWithinDays(safeRecords, 90).length;
  const petsWithRecords = petAnalyses.filter((item) => item.visitCount > 0).length;

  const regularPets = petAnalyses.filter((item) => {
    const label = item.routineStats?.routineType ?? "";
    return (
      label.includes("1주") ||
      label.includes("2주") ||
      label.includes("3주") ||
      label.includes("4주")
    );
  }).length;

  const irregularPets = petAnalyses.filter((item) => {
    const label = item.routineStats?.routineType ?? "";
    return label.includes("불규칙") || label.includes("혼합");
  }).length;

  const attentionPets = [...petAnalyses]
    .filter((item) => item.concernScore >= 3)
    .sort((a, b) => b.concernScore - a.concernScore);

  const longestGapPets = [...petAnalyses]
    .filter((item) => typeof item.daysFromLatest === "number")
    .sort((a, b) => (b.daysFromLatest ?? 0) - (a.daysFromLatest ?? 0));

  const summaryText = [
    `${guardianName || "보호자"}님 가정에는 총 ${safePets.length}마리의 반려견이 등록되어 있습니다.`,
    `누적 방문 기록은 ${totalVisits}건이며, 최근 90일 방문은 ${recent90Visits}건입니다.`,
    petsWithRecords > 0
      ? `기록이 있는 아이는 ${petsWithRecords}마리입니다.`
      : "아직 방문 데이터가 누적되지 않았습니다.",
    regularPets > 0
      ? `정기 루틴으로 보이는 아이는 ${regularPets}마리입니다.`
      : "정기 루틴은 아직 뚜렷하지 않습니다.",
    irregularPets > 0 ? `혼합 또는 불규칙 패턴 아이는 ${irregularPets}마리입니다.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const quickCounselScript = [
    `${guardianName || "보호자"}님, 현재 가정 전체 기록을 보면`,
    `${safePets.length}마리 기준으로 누적 방문 ${totalVisits}건이 쌓여 있어요.`,
    regularPets > 0
      ? `정기적으로 루틴이 잡힌 아이가 ${regularPets}마리 있어서 관리 흐름은 비교적 안정적인 편입니다.`
      : `아직 루틴이 뚜렷하지 않은 아이들이 있어 방문 주기를 같이 맞춰보면 좋겠습니다.`,
    attentionPets.length > 0
      ? `최근 상태 기준으로는 ${attentionPets
          .slice(0, 2)
          .map((item) => item.pet.name ?? "이름없음")
          .join(", ")} 쪽을 조금 더 세심하게 보시면 좋겠습니다.`
      : `최근 기록상 급하게 우려되는 아이는 크지 않아 보입니다.`,
  ].join(" ");

  return {
    petsCount: safePets.length,
    totalVisits,
    recent90Visits,
    petsWithRecords,
    regularPets,
    irregularPets,
    needsAttentionCount: attentionPets.length,
    longestGapPetName: longestGapPets[0]?.pet.name ?? null,
    longestGapDays: longestGapPets[0]?.daysFromLatest ?? null,
    summaryText,
    overallTone: getGuardianOverallTone(totalVisits, safePets.length),
    quickCounselScript,
    petAnalyses,
  };
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}