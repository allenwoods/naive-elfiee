import type { Event } from '@/bindings'

/**
 * 比较两个向量时钟
 * @returns 1 if vc1 > vc2, -1 if vc1 < vc2, 0 if concurrent or equal
 */
function compareVectorClocks(
  vc1: Partial<Record<string, number>>,
  vc2: Partial<Record<string, number>>
): number {
  const allEditors = new Set([...Object.keys(vc1), ...Object.keys(vc2)])

  let vc1Greater = false
  let vc2Greater = false

  for (const editor of allEditors) {
    const v1 = vc1[editor] || 0
    const v2 = vc2[editor] || 0

    if (v1 > v2) vc1Greater = true
    if (v2 > v1) vc2Greater = true
  }

  if (vc1Greater && !vc2Greater) return 1
  if (vc2Greater && !vc1Greater) return -1
  return 0
}

/**
 * 按向量时钟对事件排序（降序：最新在前）
 * 如果向量时钟无法区分先后（并发），则使用 created_at 作为备选排序依据
 */
export function sortEventsByVectorClock(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const vcResult = compareVectorClocks(a.timestamp, b.timestamp)
    if (vcResult !== 0) {
      return -vcResult // 降序
    }

    // 如果向量时钟相等或并发，按创建时间倒序
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
