// Multi-provider AI chat. Gemini default via Lovable Gateway (free for users).
// OpenAI e Anthropic usam a chave da própria empresa.

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderConfig {
  provider?: "gemini" | "openai" | "anthropic" | string;
  model?: string;
  openaiKey?: string;
  anthropicKey?: string;
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function lovableAiChat(
  messages: ChatMsg[],
  modelOrConfig: string | AiProviderConfig = "google/gemini-2.5-flash",
): Promise<string> {
  const cfg: AiProviderConfig =
    typeof modelOrConfig === "string"
      ? { provider: "gemini", model: modelOrConfig }
      : modelOrConfig;
  const provider = (cfg.provider || "gemini").toLowerCase();

  if (provider === "openai") {
    const key = cfg.openaiKey?.trim();
    if (!key) throw new Error("Chave OpenAI não configurada na sua empresa.");
    const model = cfg.model || "gpt-4o-mini";
    return openAiChat(key, model, messages);
  }
  if (provider === "anthropic") {
    const key = cfg.anthropicKey?.trim();
    if (!key) throw new Error("Chave Anthropic (Claude) não configurada na sua empresa.");
    const model = cfg.model || "claude-3-5-sonnet-latest";
    return anthropicChat(key, model, messages);
  }
  // default: Gemini via Lovable Gateway
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  const model = cfg.model || "google/gemini-2.5-flash";
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Lovable AI: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

async function openAiChat(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

async function anthropicChat(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conv = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages: conv }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const txt = (data?.content || [])
    .filter((p: any) => p?.type === "text")
    .map((p: any) => p.text)
    .join("\n")
    .trim();
  return txt;
}
