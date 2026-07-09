/* Environment + the honest brain-mode seam.
   Trove ALWAYS runs. With DASHSCOPE_API_KEY it thinks on Qwen Cloud; without it, it uses a
   clearly-labelled local offline brain. The memory engine (owned store, budgeted recall,
   reconciliation, forgetting, the numbers, persistence) is IDENTICAL and fully real in both
   modes — that is the whole point: Qwen does the thinking, Trove does the keeping. Server-only. */

export type Brain = 'qwen' | 'offline';

export function qwenKey(): string | null {
  return (
    process.env.DASHSCOPE_API_KEY ||
    process.env.QWEN_API_KEY ||
    process.env.OPENAI_API_KEY ||
    null
  );
}

export function hasQwen(): boolean {
  return !!qwenKey();
}

export function brainMode(): Brain {
  return hasQwen() ? 'qwen' : 'offline';
}

export const qwen = {
  get key() { return qwenKey(); },
  // The OpenAI-compatible surface on Alibaba Cloud Model Studio (international / Singapore leg),
  // which pairs with a plain sk- key.
  baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  // Rerank lives on the native DashScope service path (/api/v1), NOT compatible-mode (a known gotcha).
  rerankUrl:
    process.env.QWEN_RERANK_URL ||
    'https://dashscope-intl.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',
  // ASR (fun-asr / qwen3-asr-flash) — native multimodal generation endpoint.
  asrUrl:
    process.env.QWEN_ASR_URL ||
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  models: {
    biographer: process.env.TROVE_BIOGRAPHER_MODEL || 'qwen3.7-max',   // interviewer / narrator, tool loop
    listener: process.env.TROVE_LISTENER_MODEL || 'qwen3.7-plus',      // structured extraction + vision
    reconciler: process.env.TROVE_RECONCILER_MODEL || 'qwen3.6-flash', // contradiction / consolidation
    embed: process.env.TROVE_EMBED_MODEL || 'text-embedding-v4',
    rerank: process.env.TROVE_RERANK_MODEL || 'qwen3-rerank',
    image: process.env.TROVE_IMAGE_MODEL || 'wan2.6-t2i',
    asr: process.env.TROVE_ASR_MODEL || 'qwen3-asr-flash',
  },
};

export interface ModeInfo {
  brain: Brain;
  biographerModel: string;
  listenerModel: string;
  reconcilerModel: string;
  embedModel: string;
  rerankModel: string;
  imageModel: string;
  store: 'file' | 'postgres';
  /** true when the file store sits on ephemeral serverless disk (e.g. a Vercel mirror) —
      troves there may not survive between visits. The durable deployment has a real disk. */
  ephemeral: boolean;
  durableUrl: string | null;
  note: string;
}

export function modeInfo(): ModeInfo {
  const brain = brainMode();
  const ephemeral = !!process.env.VERCEL && !process.env.DATABASE_URL;
  return {
    brain,
    ephemeral,
    durableUrl: ephemeral ? process.env.TROVE_DURABLE_URL || 'http://47.84.113.80:3009' : null,
    biographerModel: brain === 'qwen' ? qwen.models.biographer : 'trove-offline-biographer',
    listenerModel: brain === 'qwen' ? qwen.models.listener : 'trove-offline-listener',
    reconcilerModel: brain === 'qwen' ? qwen.models.reconciler : 'trove-offline-reconciler',
    embedModel: brain === 'qwen' ? qwen.models.embed : 'trove-local-hash-v1',
    rerankModel: brain === 'qwen' ? qwen.models.rerank : 'trove-local-rerank',
    imageModel: brain === 'qwen' ? qwen.models.image : 'trove-photomosaic',
    store: process.env.DATABASE_URL ? 'postgres' : 'file',
    note:
      brain === 'qwen'
        ? 'Live on Qwen Cloud — the telling is extracted, reconciled, embedded, reranked and interviewed on Qwen. The store is Trove’s own.'
        : 'Offline mode — the memory engine (owned store, budgeted recall, reconciliation, forgetting, the numbers) is fully real; extraction and interviewing run on Trove’s local brain. Set DASHSCOPE_API_KEY to switch the brain to Qwen Cloud.',
  };
}
