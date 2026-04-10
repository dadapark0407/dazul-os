export type VisitRecord = {
  id: string
  guardian_id: string
  pet_id: string
  visit_date: string
  service_type: string | null
  note: string | null

  skin_status: string | null
  coat_status: string | null
  condition_status: string | null
  stress_status: string | null
  special_notes: string | null
  next_visit_recommendation: string | null
  care_summary: string | null
  care_actions: string | null
  care_notes: string | null
  next_care_guide: string | null

  created_at?: string
}