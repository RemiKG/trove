/* Raw Qwen Cloud calls over the OpenAI-compatible surface on Alibaba Cloud Model Studio
   (dashscope-intl compatible-mode) + the native DashScope rerank / ASR services. Every function
   throws on failure; callers catch and fall back to the offline brain, so a missing or expired
   key degrades honestly, never crashes. All core inference targets
   https://dashscope-intl.aliyuncs.com with a plain sk- key. */
import { qwen } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = qwen.key;
  if (!key) throw new Error('no Qwen key');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extra };
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 120000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Non-streaming chat completion. Returns the assistant message content + any tool calls. */
export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; response_format?: any; tools?: any[]; max_tokens?: number; extra_body?: any } = {},
): Promise<{ content: string; tool_calls: any[]; raw: any }> {
  const body: any = {
    model: opts.model || qwen.models.biographer,
    messages,
    temperature: opts.temperature ?? 0.7,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.max_tokens ? { max_tokens: opts.max_tokens } : {}),
    ...(opts.extra_body || {}),
  };
  const res = await withTimeout((signal) =>
    fetch(`${qwen.baseUrl}/chat/completions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal }),
  );
  if (!res.ok) throw new Error(`qwen chat ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = await res.json();
  const msg = raw?.choices?.[0]?.message ?? {};
  return { content: msg.content || '', tool_calls: msg.tool_calls || [], raw };
}

/** Streaming chat completion — yields text deltas as they arrive (for the biographer's voice). */
export async function* chatStream(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; max_tokens?: number; extra_body?: any } = {},
): AsyncGenerator<string> {
  const body: any = {
    model: opts.model || qwen.models.biographer,
    messages,
    temperature: opts.temperature ?? 0.7,
    stream: true,
    ...(opts.max_tokens ? { max_tokens: opts.max_tokens } : {}),
    ...(opts.extra_body || {}),
  };
  const res = await withTimeout((signal) =>
    fetch(`${qwen.baseUrl}/chat/completions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal }),
    120000,
  );
  if (!res.ok || !res.body) throw new Error(`qwen stream ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const j = JSON.parse(payload);
        const delta = j?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* ignore keep-alive / partial frames */
      }
    }
  }
}

/** Multimodal chat (vision) — read a photo of an old picture / document held to the camera. */
export async function visionRead(imageDataUrl: string, prompt: string, opts: { model?: string } = {}): Promise<string> {
  const body: any = {
    model: opts.model || qwen.models.listener,
    messages: [
      { role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ] },
    ],
    temperature: 0.3,
    max_tokens: 700,
  };
  const res = await withTimeout((signal) =>
    fetch(`${qwen.baseUrl}/chat/completions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal }),
    60000,
  );
  if (!res.ok) throw new Error(`qwen vision ${res.status}`);
  const raw = await res.json();
  return raw?.choices?.[0]?.message?.content || '';
}

/** text-embedding-v4 embeddings (available behind the seam; the owned local index is the default). */
export async function embed(texts: string[], model?: string): Promise<number[][]> {
  const res = await withTimeout((signal) =>
    fetch(`${qwen.baseUrl}/embeddings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ model: model || qwen.models.embed, input: texts }),
      signal,
    }),
  );
  if (!res.ok) throw new Error(`qwen embed ${res.status}`);
  const raw = await res.json();
  return (raw?.data || []).map((d: any) => d.embedding as number[]);
}

/** qwen3-rerank via the DashScope text-rerank service. Returns a score in [0,1] per doc, in order. */
export async function rerankScores(query: string, docs: string[], model?: string): Promise<number[]> {
  const res = await withTimeout((signal) =>
    fetch(qwen.rerankUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: model || qwen.models.rerank,
        input: { query, documents: docs },
        parameters: { return_documents: false, top_n: docs.length },
      }),
      signal,
    }),
  );
  if (!res.ok) throw new Error(`qwen rerank ${res.status}`);
  const raw = await res.json();
  const results = raw?.output?.results || [];
  const scores = new Array(docs.length).fill(0);
  for (const r of results) {
    if (typeof r.index === 'number') scores[r.index] = typeof r.relevance_score === 'number' ? r.relevance_score : 0;
  }
  return scores;
}

/** qwen3-asr-flash / fun-asr — "just let them talk". Transcribe a public audio URL. */
export async function transcribe(audioUrl: string, opts: { model?: string } = {}): Promise<string> {
  const body: any = {
    model: opts.model || qwen.models.asr,
    input: { messages: [{ role: 'user', content: [{ audio: audioUrl }] }] },
    parameters: {},
  };
  const res = await withTimeout((signal) =>
    fetch(qwen.asrUrl, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal }),
    90000,
  );
  if (!res.ok) throw new Error(`qwen asr ${res.status}`);
  const raw = await res.json();
  const choices = raw?.output?.choices || [];
  const content = choices[0]?.message?.content;
  if (Array.isArray(content)) return content.map((c: any) => c.text || '').join(' ').trim();
  return String(content || raw?.output?.text || '').trim();
}

/** wan2.6-t2i / qwen-image seed-locked illustration. Best-effort; the mosaic is real without it. */
export async function image(prompt: string, opts: { model?: string; seed?: number; size?: string } = {}): Promise<string | null> {
  try {
    const res = await withTimeout((signal) =>
      fetch(`${qwen.baseUrl}/images/generations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          model: opts.model || qwen.models.image,
          prompt,
          n: 1,
          size: opts.size || '1024x1024',
          ...(opts.seed != null ? { seed: opts.seed } : {}),
        }),
        signal,
      }),
      90000,
    );
    if (!res.ok) throw new Error(`qwen image ${res.status}`);
    const raw = await res.json();
    return raw?.data?.[0]?.url || raw?.data?.[0]?.b64_json || null;
  } catch {
    return null;
  }
}
