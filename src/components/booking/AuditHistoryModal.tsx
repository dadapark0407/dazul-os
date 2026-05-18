'use client'

import { useEffect, useRef, useState } from 'react'
import { getAuditLogs, type AuditLog, type AuditAction } from '@/lib/booking/actions'

type Props = {
  open: boolean
  onClose: () => void
}

const ACTION_LABEL: Record<AuditAction, string> = {
  created: '등록',
  updated: '수정',
  cancelled: '취소',
  deleted: '삭제',
}

const ACTION_COLOR: Record<AuditAction, string> = {
  created: '#7A9E8A',
  updated: '#8A8A7A',
  cancelled: '#C9A96E',
  deleted: '#B85450',
}

function formatRowDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const yy = String(kst.getUTCFullYear()).slice(2)
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  return { date: `${yy}/${mo}/${dd}`, time: `${hh}:${mi}` }
}

export default function AuditHistoryModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const myReq = ++reqIdRef.current
    const t = setTimeout(async () => {
      try {
        const data = await getAuditLogs(query)
        if (reqIdRef.current === myReq) {
          setLogs(data)
          setLoading(false)
        }
      } catch {
        if (reqIdRef.current === myReq) {
          setLogs([])
          setLoading(false)
        }
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          borderRadius: 0,
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #E8E5E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#8A8A7A',
              }}
            >
              CHANGE HISTORY
            </p>
            <p style={{ marginTop: 4, fontSize: 15, color: '#1A1A1A', letterSpacing: '0.02em' }}>
              예약 변경 이력
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              color: '#8A8A7A',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #F2F0EC' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="강아지 이름 또는 키워드로 검색"
            style={{
              width: '100%',
              height: 36,
              padding: '0 12px',
              background: '#FAFAF8',
              border: '1px solid #E8E5E0',
              borderRadius: 0,
              fontSize: 13,
              color: '#1A1A1A',
              outline: 'none',
              letterSpacing: '0.02em',
            }}
          />
        </div>

        {/* 리스트 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '24px 22px', fontSize: 13, color: '#8A8A7A' }}>
              불러오는 중...
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div style={{ padding: '24px 22px', fontSize: 13, color: '#8A8A7A' }}>
              {query.trim() ? '검색 결과 없음' : '아직 기록된 이력이 없습니다'}
            </div>
          )}
          {!loading && logs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAF8' }}>
                  <th style={thStyle}>날짜</th>
                  <th style={thStyle}>구분</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>변경 내용</th>
                  <th style={thStyle}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const { date, time } = formatRowDate(log.created_at)
                  return (
                    <tr key={log.id} style={{ borderTop: '1px solid #F2F0EC' }}>
                      <td style={tdStyle}>
                        <div>{date}</div>
                        <div style={{ fontSize: 11, color: '#8A8A7A' }}>{time}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            fontSize: 11,
                            letterSpacing: '0.08em',
                            color: '#FFFFFF',
                            background: ACTION_COLOR[log.action],
                            borderRadius: 0,
                          }}
                        >
                          {ACTION_LABEL[log.action]}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', color: '#1A1A1A' }}>
                        {log.description}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#1A1A1A' }}>
                        {log.staff_actor_name}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8A8A7A',
  textAlign: 'center',
  fontWeight: 600,
  borderBottom: '1px solid #E8E5E0',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: '#1A1A1A',
  verticalAlign: 'top',
  textAlign: 'center',
  letterSpacing: '0.02em',
}
