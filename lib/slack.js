// 슬랙 알림 (Incoming Webhook). SLACK_WEBHOOK_URL 이 없으면 조용히 건너뜀
export async function notifySlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    return r.ok;
  } catch {
    return false;
  }
}
