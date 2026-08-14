// =============================================================
// DAZUL OS — 제품 ai_summary 일괄 초안
// =============================================================
// 최초 생성: 2026-08-10
// 최신 갱신: 2026-08-10 (사용자 교차검증 결과 재검증 후 반영)
//
// 방식: 제품명 + 브랜드로 웹검색 → 톤 프로파일 적용
// 톤: 40~60자, 명사형 종결, [핵심 성분] + [기능] + [제품 유형]
// 예외 표기:
//   - "[검색실패]" — 웹검색으로 제품 정보를 못 찾음 (URL 없음)
//   - "[정보부족] ..." — 상품 존재는 확인, 성분/공식 상세 페이지 부족
// 저장은 /admin/products/bulk-summary 페이지에서 개별 체크 후 진행.
// =============================================================

export type AiSummaryDraft = {
  id: string
  name: string
  brand: string | null
  summary: string
  url: string | null
}

export const AI_SUMMARY_DRAFTS: AiSummaryDraft[] = [
  // ── 샴푸 ─────────────────────────────────────────────
  // 프로펨(プロフェム) — 완캉クリエーション. '프로펨'과 '프로팸'은 같은 브랜드의 다른 한글표기
  { id: '084d85e5-28a4-4fd4-ba14-57a20decd292', name: '프로펨 볼륨 샴푸', brand: 'PropHem', summary: '가수분해로얄젤리단백질 성분이 함유되어 볼륨감 있는 스타일링을 완성하는 저자극 샴푸', url: 'https://trym-pet.net/product.php?id=3979' },
  { id: 'cb44ecdd-5600-44e5-8d1c-c1dc57da91fe', name: '네발이네 비누', brand: '네발이네', summary: '[검색실패]', url: null },
  { id: '5e66359a-53cb-4039-a457-4ce7581681a3', name: '아이엠머드 샴푸', brand: '디얼스코', summary: '[정보부족] 데일리 세정과 보습을 케어하는 강아지용 머드 샴푸', url: 'https://kroomize.com/product/%EB%94%94%EC%96%BC%EC%8A%A4%EC%BD%94-%EC%95%84%EC%9D%B4%EC%97%A0%EB%A8%B8%EB%93%9C-%EA%B0%95%EC%95%84%EC%A7%80-%EC%83%B4%ED%91%B8-300ml-%EC%95%84%EC%BF%A0%EC%95%84%ED%96%A5/5806/' },
  // 리독(Leadog) — 일본 브랜드. Type.A(지성)·Type.B(보통)·Type.C(민감성) 3종 라인업 (leadog.net 확인)
  { id: '2f5bd2e9-4db6-4bed-9b2f-49ebf1759900', name: '리독 샴푸', brand: '리독', summary: '지성·보통·민감성 3종 라인업으로 세라마이드와 케라틴이 함유된 살롱용 아미노산 샴푸', url: 'https://www.leadog.net/p/3/' },
  { id: '3d504421-88f5-4652-8f99-6fff509b9721', name: '베사봉 비누', brand: '베사봉', summary: '[정보부족] 모질별 저자극 케어를 관리하는 반려동물 천연 수제 비누', url: 'https://baesavon.com/category/%EC%9D%BC%EB%B0%98%EC%9A%A9%EB%9F%89/29/' },
  { id: '5ef7a79f-ceda-4949-bc09-f0eb43ad8646', name: '익스트림볼륨 샴푸', brand: '아이그룸', summary: '[정보부족] 풍성한 볼륨감을 오래 지속시키는 프리미엄 볼륨 샴푸', url: 'https://www.igroomkorea.co.kr/goods/goods_view.php?goodsNo=1000000078' },
  // 아코코(ACOCO) — 일본 브랜드, Dog Salon sugar&coco. 라벤더꽃수 베이스. 라벤더 성분으로 고양이 사용 불가
  { id: '1828150c-e975-4a5c-8d28-3d4cd6d70531', name: '아코코 샴푸', brand: '아코코', summary: '라벤더꽃수 베이스에 무실리콘·무향료로 사람과 병용 가능한 저자극 폼샴푸 (고양이 사용 금지)', url: 'https://333dogcare.com/product/acocoshampoo/' },
  // 이누후와리 휩매직(ホイップマジック) — 살롱용 사전 클렌징 폼 오일. 성분표 재검증에서 fetch 결과 상충 → 성분 언급 최소화
  { id: 'f83b7243-de46-4ea3-98e9-cab102a64845', name: '휩매직', brand: '이누후와리', summary: '[정보부족] 라우로일 계열 아미노산 세정 성분 기반 살롱용 사전 클렌징 폼 오일', url: 'https://item.rakuten.co.jp/life-generation/p710041f/' },
  { id: 'a60b6fea-8ca7-4769-b70f-82263be78ced', name: '하이포닉 프로 딥클렌징', brand: '하이포닉', summary: '[정보부족] 강화된 세정력으로 피모를 케어하는 프리미엄 딥클렌징 샴푸', url: 'https://hyponicb2b.co.kr/m/goods/goods_list.php?category=0105000000' },

  // ── 린스 ─────────────────────────────────────────────
  { id: '52dd378c-ab35-4d54-bdc3-79bab89c2890', name: '비비라벨 트리트먼트', brand: '독샤워', summary: '유산균 성분이 함유되어 손상모와 장모를 케어하는 저자극 트리트먼트', url: 'https://m.dogshower.co.kr/product/detail.html?product_no=245' },
  // 리독(Leadog) — 신제품 트리트먼트 공지만 있고 상세페이지 미공개
  { id: '156d7622-b9ac-4a93-8595-389bdd64bca2', name: '리독 컨디셔너', brand: '리독', summary: '[정보부족] 케라틴 성분이 포함되어 코트에 볼륨과 부드러운 마무리를 더하는 케어 트리트먼트', url: 'https://www.leadog.net/' },
  // 프로팸(프로펨과 동일 브랜드 プロフェム) — pet-wagon 페이지에 【2026年2月28日終売】 명시, OutOfStock
  { id: 'b9201cf8-8e5e-4533-bd2d-42a1f121555f', name: '프로팸 볼륨 컨디셔너', brand: '프로팸', summary: '가수분해콜라겐과 로얄젤리단백질이 포함되어 솜털처럼 부드러운 볼륨을 완성하는 컨디셔너 (2026-02-28 단종)', url: 'https://pet-wagon.com/shop/g/g4562410851352/' },
  // 코트레스큐 컨디셔너 (Coat Rescue) — 미주 공식몰에서 URL·전성분 확인
  { id: 'cd79d334-6471-4915-ae21-e8b478dfc947', name: '코트레스큐 컨디셔너', brand: '플러쉬퍼피', summary: '카올린과 아몬드오일 세이지 해초 추출물이 함유되어 건조·손상모의 탄력을 회복시키는 보습 컨디셔너', url: 'https://plushpuppyamerica.com/product/coat-rescue-2-2/' },
  // 하이포닉 컨디셔너 — 실제 정식명은 '하이포닉 그루밍아티스트 실키 컨디셔너' (하이포닉=브랜드, 그루밍아티스트=서브라인)
  { id: 'd2d0a08e-8f14-41c8-8bb8-2802a6523b20', name: '하이포닉 컨디셔너', brand: '하이포닉', summary: '[정보부족] 하이포닉 그루밍아티스트 라인의 식물유래 세정 성분 기반 저자극 실키 컨디셔너', url: null },

  // ── 팩 ───────────────────────────────────────────────
  // 아유르베다 허브팩 — DB명은 아유르베다이나 실제 브랜드는 '애니멀베다' (독샤워). 라인업: 센시티브/모이스쳐/피토헬스 3종
  { id: '0ec04d74-fd7c-445c-bca6-cd871a01e7a1', name: '아유르베다 허브팩', brand: '독샤워', summary: '인도산 유기농 애니멀베다 허브 성분이 함유되어 민감성 피부의 진정과 보습을 케어하는 저자극 허브팩', url: 'https://m.dogshower.co.kr/product/detail.html?product_no=543' },
  // 아이엠머드 머드팩 — '화이트 머드팩' 확인, 성분 상세는 페이지에 없음
  { id: 'c15bccce-32d1-4e90-85e8-80bfbb0052e0', name: '아이엠머드 머드팩', brand: '디얼스코', summary: '[정보부족] 화이트 머드 성분이 함유되어 모공과 피모 관리에 도움을 주는 동물용의약외품 머드팩', url: 'https://m.pet-friends.co.kr/product/detail/181514' },
  // 비알 머드팩 — 정식명 'BRMUD 릴리프 머드 샴푸 포 도그스'. DB는 팩으로 분류되어 있으나 실제 제형은 샴푸(자연유래 96.24% 보령머드)
  { id: '67b950a4-68a7-40ce-8708-2099f48fba31', name: '비알 머드팩', brand: '비알머드', summary: '보령머드 96.24% 자연유래 성분이 함유되어 민감·건성 피부를 저자극으로 케어하는 릴리프 머드 샴푸', url: 'https://brmudkorea.com/product/%EB%A6%B4%EB%A6%AC%ED%94%84-%EB%A8%B8%EB%93%9C-%EC%83%B4%ED%91%B8-%ED%8F%AC-%EB%8F%84%EA%B7%B8%EC%8A%A4-500ml/59/' },
  // 로즈팩(이누후와리 ローズモイスチャーパック) — 살롱용 트리트먼트 팩. 성분 상세 미공개
  { id: '6f983411-6599-428a-8381-283f3cd27c21', name: '로즈팩', brand: '이누후와리', summary: '[정보부족] 장미 정유가 함유되어 피모에 보습과 광택을 더하는 프리미엄 살롱 트리트먼트 팩', url: 'https://www.asobolabo.com/?pid=163504562' },
  { id: 'b30107b7-a635-4c41-9f87-e1f40d2bb871', name: '허니 휩 크림 팩', brand: '코코슈', summary: '꿀 성분과 단백질, 자연 유래 오일이 함유되어 피부 보습과 피모 윤기를 케어하는 휩 크림팩', url: 'https://www.cocochoux.co.kr/shop_view/?idx=20' },
  { id: '4ca39700-9cfa-4838-b668-e312d4d76a04', name: '허브 에센스 팩', brand: null, summary: '[검색실패]', url: null },

  // ── 스파 ─────────────────────────────────────────────
  { id: '37a47ff1-2793-4585-bce1-a13825d70815', name: '버블스파', brand: '레나독', summary: '[정보부족] 펫그루머 전용으로 데일리 목욕 케어에 사용하는 프리미엄 버블스파', url: 'https://breezytailb2b.com/article/%EB%A6%AC%EB%B7%B0/4/1340/' },
  { id: '9bcdd6d0-30d9-4ac1-a4ee-cb00296d13f9', name: '아로마 젤리 스파', brand: '버블부들', summary: '[정보부족] 아로마 성분을 사용하여 목욕 시 피모 케어에 도움을 주는 젤리 스파', url: 'https://www.kepco.pe.kr/product/%EB%B2%84%EB%B8%94%EB%B6%80%EB%93%A4-%EA%B0%95%EC%95%84%EC%A7%80-%EC%95%84%EB%A1%9C%EB%A7%88-%EC%97%90%EC%84%BC%EC%8A%A4' },
  // 로제솔트스파 — 정식명 '페토세라 로제솔트 입욕제' (브리지테일 유통, PETO'CERA 브랜드)
  { id: '446e4ecf-c875-4050-b30d-e01eb14f9ee3', name: '로제솔트스파', brand: '브리지테일', summary: '히말라야 핑크솔트 94종 미네랄이 함유되어 피부 탄력과 노화 예방을 케어하는 페토세라 로제솔트 입욕제', url: 'https://breezytail.com/category/petocera/59/' },
  // 블루마린스파 — 정식명 '페토세라 블루마린 입욕제'
  { id: '3cf8e4f8-3039-40b8-8cab-a208cdb8f3af', name: '블루마린스파', brand: '브리지테일', summary: '울릉도 해양심층수와 자이언트 켈프 마린 컴플렉스가 함유되어 피부 장벽을 케어하는 페토세라 블루마린 입욕제', url: 'https://breezytail.com/category/petocera/59/' },
  { id: '2c08b60e-6ba1-4409-a39e-424d4d505504', name: '담금초 입욕제', brand: '슈룹', summary: '[정보부족] 반려동물 전용 목욕 케어에 사용하는 데일리 입욕제', url: 'https://www.petshome.co.kr/shop_view/?idx=1704' },
  { id: '46fb8ddb-dedf-4c6d-9b8a-3d4751ee48a3', name: '실키 스파', brand: '스킨들리', summary: '[정보부족] 스킨들리의 프리미엄 반려동물 피모케어 데일리 스파', url: 'https://www.skindlykorea.com/' },
  // 허벌 스파(스킨들리 허벌스파팩) — 브랜드 확인. 성분 상세는 페이지 텍스트에 미노출
  { id: '27911428-1695-44b5-9d23-d35a04715cd0', name: '허벌 스파', brand: '스킨들리', summary: "[정보부족] 님잎 추출물과 '플루라쥬' 성분이 함유되어 피부 밸런스를 케어하는 젤리 타입 허벌 스파", url: 'https://www.skindlykorea.com/shop1/?idx=41' },
  // 일리리노 피모 스파 — 랜딩페이지 성분 미확인. product URL로 교체
  { id: '87a74838-6270-484c-a976-d8c70e8a5479', name: '일리리노 피모 스파', brand: '시셀리노', summary: '[정보부족] 인체 지방줄기세포 배양액이 함유되어 피모 깊은 곳까지 보습을 더하는 고기능성 피모 스파', url: 'https://c-cell-lino.jp/product/ili-lino.html' },
  { id: '4c736053-1bf9-4f28-b2ba-e801a2c4245b', name: '일리리노 피부 스파', brand: '시셀리노', summary: '리포좀 줄기세포 배양액과 올리브 오일이 함유되어 예민한 피부를 케어하는 저자극 피부 스파', url: 'https://c-cell-lino.jp/product/ili-lino-hifu.html' },
  // PCP100(시셀리노 콜라겐 케어) — 전성분 '加水分解コラーゲン末' 단일 성분 확인. 큐티클 언급 없음
  { id: '9f8568e8-0d0e-42ed-8798-034ab7346c4e', name: '콜라겐 케어', brand: '시셀리노', summary: '가수분해콜라겐말 단일 성분 처방으로 손상모의 보습과 탄력을 관리하는 고기능성 콜라겐 케어', url: 'https://c-cell-lino.jp/product/pcp100.html' },
  // 아유르님 — 정식명이 '아유르님 입욕제' (스파 아님). SNS 위주 노출
  { id: 'd6e25f46-c262-462e-8f5b-d8d4307b658b', name: '아유르님 스파', brand: '아유르님', summary: '[정보부족] 인도 아유르베다의 님(Neem) 성분이 함유되어 피부 균 밸런스를 재정비하는 데일리 케어 입욕제', url: 'https://www.threads.com/@ayur_neem/post/DSqy-Z9ksv3/' },
  { id: '428df952-43ab-415a-8b8c-f484adf528d2', name: '액티브 스파', brand: '액티브', summary: '[검색실패]', url: null },
  // 이누후와리 로즈버블스파 — 별도 SKU가 아닌 살롱 시술(로즈팩+휩아로마바스 조합)일 가능성
  { id: 'd2877d0f-6d9e-4edb-9a08-d8adb93f723b', name: '로즈버블스파', brand: '이누후와리', summary: '[정보부족] 장미 정유 팩과 저자극 휩 아로마 버블이 함유되어 피모를 촉촉하게 감싸는 프리미엄 살롱 버블 스파', url: 'https://www.asobolabo.com/?gid=2427610&mode=grp&sort=n' },
  // 탄산 스파 — 이전 URL이 다른 브랜드(몽스파)로 잘못 연결
  { id: '5733d245-401e-4ee0-8a09-0d9f30e2f1a6', name: '탄산 스파', brand: '탄산기기', summary: '[정보부족] 고농도 탄산이 함유되어 각질과 노폐물 세정, 혈행 순환에 도움을 주는 데일리 탄산 스파', url: null },

  // ── 피부케어 ─────────────────────────────────────────
  // 하이드레이팅 3-6-9(닥터아나) — 서울대 수의피부과 공동 개발. 녹차수 베이스
  { id: '6a2ecee5-910c-4dce-99de-871e27c495b6', name: '하이드레이팅 3-6-9 바르는 오메가', brand: '닥터아나', summary: '녹차수와 오메가 3-6-9 지방산이 함유되어 피부 장벽 강화와 진정에 도움을 주는 저자극 워터오일 앰플', url: 'https://lifet.co.kr/Store/Product/Detail?productCode=P00495' },
  // 셀케어 스킨 미스트 — 이전 URL이 다른 상품(셀케어 스킨솔루션). 줄기세포·28,000원까지 확인, 세부 규격 미확인
  { id: '8acebbe1-6c2f-4dd1-bf8c-74a992e43d83', name: '셀케어 스킨 미스트', brand: '독샤워', summary: '[정보부족] 줄기세포 배양액이 함유되어 피부 재생과 진정, 모낭까지 관리하는 고기능성 셀케어 스킨 미스트', url: null },
  { id: '041faedb-892c-4b75-bfa4-d7a5a28d3259', name: '스킨 쉴드 에센스 앰플', brand: '독샤워', summary: '저자극 기능성 성분이 함유되어 민감한 피부의 장벽을 케어하는 프리미엄 스킨 쉴드 앰플', url: 'https://dogshower.co.kr/product/%EC%8A%A4%ED%82%A8-%EC%89%B4%EB%93%9C-%EC%97%90%EC%84%BC%EC%8A%A4-%EC%95%B0%ED%94%8C-%EB%AF%BC%EA%B0%90%ED%95%9C-%ED%94%BC%EB%B6%80%EB%A5%BC-%EC%9C%84%ED%95%9C-%EA%B8%B0%EB%8A%A5%EC%84%B1-%EC%97%90%EC%84%BC%EC%8A%A4-%EC%95%B0%ED%94%8C/886/' },
  { id: 'eec9b86d-87fb-44e0-9eb7-d0a9cf8b3a97', name: '보습 로션', brand: '아소보라보', summary: '[정보부족] 건조한 피부에 수분을 공급하는 반려동물 데일리 케어용 저자극 보습 로션', url: 'https://www.asobolabo.com/' },

  // ── 피모케어 ─────────────────────────────────────────
  { id: '7e07f61c-77d9-4e7b-b56d-123e2dccd684', name: '새틴 미스트', brand: '독샤워', summary: '[정보부족] 코트에 매끄러운 광택과 촉감을 더하는 반려동물 데일리 케어용 새틴 미스트', url: 'https://dogshower.co.kr/' },
  { id: '18db96db-9cdd-41eb-b784-dcb648284470', name: '독스미어 미스트', brand: '독스미어', summary: '[정보부족] 피모의 결을 정돈하고 데일리 관리에 사용하는 반려동물 케어용 미스트', url: 'https://pethugb2b.co.kr/category/%EB%8F%85%EC%8A%A4%EB%AF%B8%EC%96%B4/126/' },
  { id: '06c6a175-9443-486c-ad79-abcbe723bc4c', name: '프로틴 미스트', brand: '아유르님', summary: '[정보부족] 코트에 단백질을 공급하여 결을 관리하는 반려동물 케어용 프로틴 미스트', url: 'https://enervis-pet.com/' },
  // 신데렐라 미스트(이누후와리) — Yahoo 페이지에 4종 세라마이드(EOP/NG/AG/AP) + 히알루론산Na 실제 확인
  { id: '265e3e34-3925-4349-a52f-a47382844231', name: '신데렐라 미스트', brand: '이누후와리', summary: '4종 세라마이드(EOP·NG·AG·AP)와 히알루론산나트륨이 함유되어 손상 장벽을 케어하는 데일리 보습 미스트', url: 'https://store.shopping.yahoo.co.jp/cannanaonline/25-missceram.html' },
  { id: 'c14c3c2f-a459-4b7c-ab9b-897a15116fe2', name: 'TLC 코트 컨디셔너', brand: '플러쉬퍼피', summary: '야로우 세이지 로즈마리 성분이 함유되어 건조한 피부와 코트를 진정시키는 케어용 컨디셔너', url: 'https://www.plushpuppy.co.uk/show-dog-conditioners/t-l-c-coat-conditioner/' },
  // Shine and Comb — 첫 성분이 Cyclotetrasiloxane (사용자의 Cyclomethicone은 부정확)
  { id: '896972b8-9994-45d2-9408-f3f7f19191de', name: '샤인 앤 콤 미스트', brand: '플러쉬퍼피', summary: '사이클로테트라실록산 베이스의 오일프리 경량 처방으로 코트에 광택과 디탱글 마무리를 더하는 미스트', url: 'https://plushpuppy.com.au/product/shine-and-comb/' },
  { id: '668162f0-c47b-44e5-8454-b457469af4e7', name: '씨브리즈 오일', brand: '플러쉬퍼피', summary: '카렌듈라 밀배아 이브닝프라임로즈 오일이 포함되어 광택과 수분을 더하는 하이드레이팅 코트 오일', url: 'https://plushpuppyamerica.com/product/seabreeze-oil/' },
  // 코트밤(Protein Coat Balm) — 아르니카·겐티안·주니퍼·멜리사·파인 5종 추출물 + 가수분해콜라겐 + UV필터 확인
  { id: 'e2974e89-0296-4dd1-bf57-ca777688d3b6', name: '코트밤', brand: '플러쉬퍼피', summary: '가수분해콜라겐과 UV필터, 5종 허브 추출물이 함유되어 잔머리를 정돈하는 논그리시 코트밤', url: 'https://plushpuppyamerica.com/product/protein-coat-balm/' },

  // ── 위생관리 ─────────────────────────────────────────
  { id: '2787d56a-ec8f-41a9-a149-7b9185db0dc2', name: '더블액션 치약', brand: '덴티멀', summary: '천연 효소와 배 석세포 성분이 함유되어 플라그와 치석 예방에 도움을 주는 데일리 치약', url: 'https://m.breezytailb2b.com/product/detail.html?product_no=385&cate_no=158&display_group=1' },
  // 미스터오일(이누후와리 Mr.OIL) — 라쿠텐 성분표에서 피마자유(ヒマシ油)+PEG-20 확인. 원문의 쌀겨유는 오류
  { id: '310fed10-114a-40cd-97a1-b874dc4572cc', name: '미스터오일', brand: '이누후와리', summary: '피마자유 베이스에 PEG-20 글리세릴과 토코페롤·로즈마리 추출물이 함유된 저자극 클렌징 오일', url: 'https://item.rakuten.co.jp/logos-pet/grm-inufuwari-4582514710126/' },
  { id: '19ff092f-f56c-47b0-b0aa-34e9acb465c2', name: '버들이 전용 귀세정제', brand: null, summary: '[검색실패]', url: null },
]
