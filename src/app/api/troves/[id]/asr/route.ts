import { NextResponse } from 'next/server';
import { hasQwen } from '@/lib/config';
import { transcribe } from '@/lib/llm/qwen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The "just let them talk" server seam — Qwen ASR (qwen3-asr-flash / fun-asr) transcribes a
    publicly-reachable audio URL when a key is set. The browser also does live on-device speech
    capture (SpeechRecognition) so spoken input works with no key; this is the cloud path that
    activates the moment DASHSCOPE_API_KEY (and a reachable audio URL) exist. Honest degrade. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const audioUrl = String(body.audioUrl || '');
  if (!hasQwen()) {
    return NextResponse.json({ degraded: true, transcript: '', note: 'Qwen ASR needs DASHSCOPE_API_KEY. The browser captured speech on-device instead.' });
  }
  if (!audioUrl) {
    return NextResponse.json({ degraded: true, transcript: '', note: 'Provide a publicly-reachable audioUrl (e.g. Alibaba Cloud OSS) for server-side Qwen ASR.' });
  }
  try {
    const transcript = await transcribe(audioUrl);
    return NextResponse.json({ degraded: false, transcript });
  } catch (e: any) {
    return NextResponse.json({ degraded: true, transcript: '', note: `Qwen ASR error: ${String(e?.message || e).slice(0, 160)}` });
  }
}
