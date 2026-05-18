'use client'

import type { ActorInput } from './actions'

const SESSION_KEY = 'dz_booking_actor'

export type SessionActor = NonNullable<ActorInput>

export function getSessionActor(): SessionActor | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionActor
  } catch {
    return null
  }
}

export function setSessionActor(actor: SessionActor) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(actor))
}

export function clearSessionActor() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SESSION_KEY)
}
