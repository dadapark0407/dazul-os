"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Guardian = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  created_at: string;
};

type Pet = {
  id: string;
  guardian_id: string;
  name: string;
  breed: string | null;
  gender: string | null;
  birthdate: string | null;
  memo: string | null;
  created_at: string;
};

const staffOptions = ["소영", "직원1", "직원2", "직원3", "직원4"];

const serviceOptions = [
  "목욕",
  "부분미용",
  "전체미용",
  "스파",
  "팩",
  "스파+팩",
];

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

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function formatPhone(value: string | null) {
  if (!value) return "-";

  if (value.length === 11) {
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }

  if (value.length === 10) {
    return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
  }

  return value;
}

export default function NewRecordPage() {
  const router = useRouter();

  const [visitDate, setVisitDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [service, setService] = useState("");
  const [note, setNote] = useState("");

  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [guardianPets, setGuardianPets] = useState<Pet[]>([]);

  const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMessage("");

      const [guardiansRes, petsRes] = await Promise.all([
        supabase.from("guardians").select("*").order("name", { ascending: true }),
        supabase.from("pets").select("*").order("name", { ascending: true }),
      ]);

      if (guardiansRes.error) {
        setErrorMessage(`보호자 목록을 불러오지 못했어요: ${guardiansRes.error.message}`);
        setLoading(false);
        return;
      }

      if (petsRes.error) {
        setErrorMessage(`반려견 목록을 불러오지 못했어요: ${petsRes.error.message}`);
        setLoading(false);
        return;
      }

      setGuardians((guardiansRes.data ?? []) as Guardian[]);
      setPets((petsRes.data ?? []) as Pet[]);
      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedGuardianId) {
      setGuardianPets([]);
      return;
    }

    const sameHousePets = pets.filter((pet) => pet.guardian_id === selectedGuardianId);
    setGuardianPets(sameHousePets);
  }, [selectedGuardianId, pets]);

  const guardianSuggestions = useMemo(() => {
    const keywordName = guardianName.trim().toLowerCase();
    const keywordPhone = normalizePhone(guardianPhone);

    if (!keywordName && !keywordPhone) return [];

    return guardians
      .filter((guardian) => {
        const matchName = keywordName
          ? guardian.name.toLowerCase().includes(keywordName)
          : true;

        const matchPhone = keywordPhone
          ? (guardian.phone ?? "").includes(keywordPhone)
          : true;

        return matchName && matchPhone;
      })
      .slice(0, 8);
  }, [guardianName, guardianPhone, guardians]);

  const petSuggestions = useMemo(() => {
    const keyword = petName.trim().toLowerCase();
    if (!keyword) return [];

    const source = selectedGuardianId ? guardianPets : pets;

    return source
      .filter((pet) => pet.name.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [petName, selectedGuardianId, guardianPets, pets]);

  const handleGuardianInputChange = (value: string) => {
    setGuardianName(value);
    setSelectedGuardianId(null);
    setSelectedPetId(null);
    setPetName("");
    setGuardianPets([]);
  };

  const handleGuardianPhoneChange = (value: string) => {
    setGuardianPhone(normalizePhone(value));
    setSelectedGuardianId(null);
    setSelectedPetId(null);
    setPetName("");
    setGuardianPets([]);
  };

  const handleGuardianSelect = (guardian: Guardian) => {
    setGuardianName(guardian.name);
    setGuardianPhone(guardian.phone ?? "");
    setSelectedGuardianId(guardian.id);
    setSelectedPetId(null);
    setPetName("");
  };

  const handlePetInputChange = (value: string) => {
    setPetName(value);
    setSelectedPetId(null);
  };

  const handlePetSelect = (pet: Pet) => {
    setPetName(pet.name);
    setSelectedPetId(pet.id);
  };

  const handleSiblingPetClick = (pet: Pet) => {
    setPetName(pet.name);
    setSelectedPetId(pet.id);
  };

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

  const getOrCreateGuardian = async () => {
    if (selectedGuardianId) {
      return {
        guardianId: selectedGuardianId,
        guardianName: guardianName.trim(),
        guardianPhone: normalizePhone(guardianPhone),
      };
    }

    const trimmedName = guardianName.trim();
    const normalizedPhone = normalizePhone(guardianPhone);

    const existingGuardian = guardians.find(
      (guardian) =>
        guardian.name === trimmedName &&
        (guardian.phone ?? "") === normalizedPhone
    );

    if (existingGuardian) {
      return {
        guardianId: existingGuardian.id,
        guardianName: existingGuardian.name,
        guardianPhone: existingGuardian.phone ?? "",
      };
    }

    const { data, error } = await supabase
      .from("guardians")
      .insert([
        {
          name: trimmedName,
          phone: normalizedPhone || null,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "보호자 생성에 실패했어요.");
    }

    const newGuardian = data as Guardian;
    setGuardians((prev) => [...prev, newGuardian]);

    return {
      guardianId: newGuardian.id,
      guardianName: newGuardian.name,
      guardianPhone: newGuardian.phone ?? "",
    };
  };

  const getOrCreatePet = async (guardianId: string) => {
    if (selectedPetId) {
      return {
        petId: selectedPetId,
        petName: petName.trim(),
      };
    }

    const trimmedPetName = petName.trim();

    const existingPet = pets.find(
      (pet) => pet.guardian_id === guardianId && pet.name === trimmedPetName
    );

    if (existingPet) {
      return {
        petId: existingPet.id,
        petName: existingPet.name,
      };
    }

    const { data, error } = await supabase
      .from("pets")
      .insert([
        {
          guardian_id: guardianId,
          name: trimmedPetName,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "반려견 생성에 실패했어요.");
    }

    const newPet = data as Pet;
    setPets((prev) => [...prev, newPet]);

    return {
      petId: newPet.id,
      petName: newPet.name,
    };
  };

  const handleSave = async () => {
    if (!visitDate || !guardianName.trim() || !petName.trim() || !staffName || !service) {
      alert("방문일, 보호자 이름, 반려견 이름, 담당자, 서비스를 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const guardianResult = await getOrCreateGuardian();
      const petResult = await getOrCreatePet(guardianResult.guardianId);

      const { error } = await supabase.from("visit_records").insert([
        {
          visit_date: visitDate,
          guardian_name: guardianResult.guardianName,
          pet_name: petResult.petName,
          staff_name: staffName,
          service,
          note,
          guardian_id: guardianResult.guardianId,
          pet_id: petResult.petId,
        },
      ]);

      if (error) {
        throw new Error(error.message);
      }

      alert("저장이 완료되었어요.");
      router.push("/record");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "저장 중 오류가 발생했어요.";
      setErrorMessage(message);
      alert(`저장 실패: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-2xl font-bold">방문 기록 작성</h1>
        <p>불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">방문 기록 작성</h1>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">방문일</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">보호자 이름</label>
          <input
            value={guardianName}
            onChange={(e) => handleGuardianInputChange(e.target.value)}
            placeholder="예: 김소영"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">전화번호</label>
          <input
            value={guardianPhone}
            onChange={(e) => handleGuardianPhoneChange(e.target.value)}
            placeholder="숫자만 입력"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {guardianSuggestions.length > 0 && (
          <div className="rounded border bg-white">
            {guardianSuggestions.map((guardian) => (
              <button
                key={guardian.id}
                type="button"
                onClick={() => handleGuardianSelect(guardian)}
                className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
              >
                <div className="font-medium">{guardian.name}</div>
                <div className="text-sm text-gray-500">
                  {formatPhone(guardian.phone)}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedGuardianId && (
          <p className="text-sm text-gray-500">
            기존 보호자를 선택했어요.
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">반려견 이름</label>
          <input
            value={petName}
            onChange={(e) => handlePetInputChange(e.target.value)}
            placeholder="기존 반려견 선택 또는 새 반려견 입력"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {petSuggestions.length > 0 && (
          <div className="rounded border bg-white">
            {petSuggestions.map((pet) => (
              <button
                key={pet.id}
                type="button"
                onClick={() => handlePetSelect(pet)}
                className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
              >
                {pet.name}
              </button>
            ))}
          </div>
        )}

        {selectedGuardianId && guardianPets.length > 0 && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-sm font-medium">같은 집 등록 아이들</p>
            <div className="flex flex-wrap gap-2">
              {guardianPets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => handleSiblingPetClick(pet)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    selectedPetId === pet.id ? "bg-black text-white" : "bg-white"
                  }`}
                >
                  {pet.name}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <p className="mt-2 text-sm text-gray-500">
            선택된 담당자: {staffName || "-"}
          </p>
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
          <p className="mt-2 text-sm text-gray-500">
            선택된 서비스: {service || "-"}
          </p>
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
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/record")}
            className="rounded border px-4 py-2"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </main>
  );
}
