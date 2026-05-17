'use server'

import { cookies } from 'next/headers'

const COOKIE_NAME = 'dz_owner_unlock'
const DEFAULT_PIN = '1234'

function getOwnerPin(): string {
  return process.env.OWNER_PIN || DEFAULT_PIN
}

/** PIN 검증 + 성공 시 세션 쿠키 발급. */
export async function verifyOwnerPin(
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  const cleaned = (pin ?? '').replace(/\D/g, '').slice(0, 4)
  if (cleaned.length !== 4) {
    return { ok: false, error: '4자리 숫자를 입력해주세요' }
  }
  if (cleaned !== getOwnerPin()) {
    return { ok: false, error: 'PIN이 올바르지 않습니다' }
  }
  const jar = await cookies()
  jar.set(COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // 세션 쿠키 — 브라우저 종료 시 만료
    path: '/',
  })
  return { ok: true }
}

/** 현재 세션이 인증되어 있는지 확인 (서버 사이드). */
export async function isOwnerUnlocked(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COOKIE_NAME)?.value === '1'
}
