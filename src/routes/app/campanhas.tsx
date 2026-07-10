import { createFileRoute, redirect } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listCampaigns, saveCampaign, deleteCampaign, startCampaign,
  pauseCampaign, cancelCampaign, listAvailableTags, previewAudience, getCampaign,
} from "@/lib/campaigns.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Play, Pause, Trash2, X, Megaphone, Users, ImagePlus, AlertTriangle } from "lucide-react";
import { brand } from "@/config/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/campanhas")({
  head: () => ({ meta: [{ title: `${brand.name} — Campanhas` }] }),
  beforeLoad: ({ context }: any) => {
    const r = context?.membership?.role;
    if (r === "atendente") throw redirect({ to: "/app/dashboard" });
  },
  component: CampanhasPage,
});

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendada: "bg-blue-500/15 text-blue-600",
  enviando: "bg-amber-500/15 text-amber-600",
  pausada: "bg-orange-500/15 text-orange-600",
  concluida: "bg-emerald-500/15 text-emerald-600",
  cancelada: "bg-red-500/15 text-red-600",
};

function CampanhasPage() {
  const list = useServerFn(listCampaigns);
  const save = useServerFn(saveCampaign);
  const remove = useServerFn(deleteCampaign);
  const start = useServerFn(startCampaign);
  const pause = useServerFn(pauseCampaign);
  const cancel = useServerFn(cancelCampaign);
  const tagsFn = useServerFn(listAvailableTags);
  const previewFn = useServerFn(previewAudience);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [preview, setPreview] = useState<{ total: number; sample: any[] } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { toast.error("Selecione uma imagem ou vídeo."); return; }
    const maxMB = isVid ? 16 : 8;
    if (file.size > maxMB * 1024 * 1024) { toast.error(`Arquivo muito grande (máx. ${maxMB}MB).`); return; }
    setUploading(true);
    try {
      const fallback = isVid ? "mp4" : "jpg";
      const ext = ((file.name.split(".").pop() || fallback).toLowerCase().replace(/[^a-z0-9]/g, "")) || fallback;
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("campaign-media").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("campaign-media").getPublicUrl(path);
      setEditing((prev: any) => ({ ...prev, media_url: data.publicUrl }));
      toast.success(isVid ? "Vídeo anexado!" : "Imagem anexada!");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function isVideoUrl(u: string) {
    return /\.(mp4|mov|webm|3gp|mkv|avi|m4v)(\?|$)/i.test(u);
  }

  async function refresh() {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([list(), tagsFn()]);
      setRows(r as any[]); setTags(t as string[]);
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const id = setInterval(() => { void list().then((r) => setRows(r as any[])); }, 15_000);
    return () => clearInterval(id);
  }, []);

  function openNew() {
    setEditing({
      nome: "", mensagem: "", agendado_para: "", filtro_tags: [],
      intervalo_min_seg: 5, intervalo_max_seg: 20, pausa_apos_envios: 50, pausa_duracao_min: 10,
    });
    setPreview(null);
    setOpen(true);
  }

  async function calcPreview(currentTags: string[]) {
    try { setPreview(await previewFn({ data: { tags: currentTags } }) as any); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao calcular público"); }
  }

  async function handleSave() {
    if (!editing?.nome?.trim() || !editing?.mensagem?.trim()) {
      toast.error("Nome e mensagem são obrigatórios"); return;
    }
    try {
      await save({ data: {
        id: editing.id,
        nome: editing.nome.trim(),
        mensagem: editing.mensagem,
        media_url: editing.media_url || null,
        agendado_para: editing.agendado_para || null,
        filtro_tags: editing.filtro_tags ?? [],
        intervalo_min_seg: Number(editing.intervalo_min_seg) || 5,
        intervalo_max_seg: Number(editing.intervalo_max_seg) || 20,
        pausa_apos_envios: Number(editing.pausa_apos_envios) || 50,
        pausa_duracao_min: Number(editing.pausa_duracao_min) || 10,
      } });
      toast.success("Campanha salva");
      setOpen(false);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erro ao salvar"); }
  }

  async function handleStart(id: string) {
    try {
      const r: any = await start({ data: { id } });
      toast.success(`${r.total} destinatários na fila`);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erro ao iniciar"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Megaphone className="size-6" /> Campanhas <HelpTip text="Disparos em massa segmentados (por etapa do CRM, tag, etc). Respeitam horário de envio e regras anti-ban para proteger o seu número." /></h1>
          <p className="text-sm text-muted-foreground">Envie mensagens em massa para seus contatos, com agendamento e anti-ban.</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> Nova campanha</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Megaphone className="size-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Nenhuma campanha ainda</p>
          <p className="text-sm text-muted-foreground mb-4">Crie sua primeira campanha para disparar mensagens em massa.</p>
          <Button onClick={openNew}><Plus className="size-4 mr-1" /> Criar campanha</Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => {
            const pct = c.total_destinatarios ? Math.round((c.total_enviados / c.total_destinatarios) * 100) : 0;
            const tentado = (c.total_enviados || 0) + (c.total_falhas || 0);
            const failRate = tentado > 0 ? (c.total_falhas || 0) / tentado : 0;
            const emRisco = (c.total_falhas || 0) >= 3 && failRate >= 0.2;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{c.nome}</h3>
                      <Badge className={STATUS_COLOR[c.status] || ""}>{c.status}</Badge>
                      {(c.filtro_tags ?? []).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.mensagem}</p>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Users className="size-3" /> {c.total_enviados}/{c.total_destinatarios} ({pct}%)</span>
                      {c.total_falhas > 0 && <span className="text-red-600">{c.total_falhas} falhas</span>}
                      {c.agendado_para && <span>Agendada: {new Date(c.agendado_para).toLocaleString()}</span>}
                    </div>
                    {emRisco && (
                      <div className="mt-2 text-xs text-red-600 flex items-start gap-1.5 bg-red-500/10 rounded px-2 py-1.5">
                        <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                        <span>Taxa de falha alta ({Math.round(failRate * 100)}%). Seu número pode estar em risco de bloqueio — considere pausar e reduzir o volume (ative o <b>Modo aquecimento</b> em Conexão).</span>
                      </div>
                    )}
                    {c.status === "enviando" || c.status === "pausada" ? (
                      <div className="h-1.5 bg-muted rounded mt-2 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {(c.status === "rascunho") && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}>Editar</Button>
                        <Button size="sm" onClick={() => handleStart(c.id)}><Play className="size-4 mr-1" /> Iniciar</Button>
                      </>
                    )}
                    {c.status === "enviando" && (
                      <Button size="sm" variant="outline" onClick={async () => { await pause({ data: { id: c.id, pause: true } }); await refresh(); }}>
                        <Pause className="size-4 mr-1" /> Pausar
                      </Button>
                    )}
                    {c.status === "pausada" && (
                      <Button size="sm" onClick={async () => { await pause({ data: { id: c.id, pause: false } }); await refresh(); }}>
                        <Play className="size-4 mr-1" /> Retomar
                      </Button>
                    )}
                    {(c.status === "agendada" || c.status === "enviando" || c.status === "pausada") && (
                      <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Cancelar campanha?")) { await cancel({ data: { id: c.id } }); await refresh(); } }}>
                        <X className="size-4" />
                      </Button>
                    )}
                    {(c.status === "rascunho" || c.status === "concluida" || c.status === "cancelada") && (
                      <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Excluir campanha?")) { await remove({ data: { id: c.id } }); await refresh(); } }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome interno</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Promo Black Friday" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea rows={5} value={editing.mensagem} onChange={(e) => setEditing({ ...editing, mensagem: e.target.value })} placeholder="Olá {{nome}}, temos uma oferta..." />
                <p className="text-xs text-muted-foreground mt-1">Use <code>{"{{nome}}"}</code> para personalizar com o nome do contato.</p>
              </div>
              <div>
                <Label>Foto ou vídeo (opcional)</Label>
                {editing.media_url ? (
                  <div className="mt-1 flex items-center gap-3">
                    {isVideoUrl(editing.media_url) ? (
                      <video src={editing.media_url} className="size-20 rounded-lg object-cover border border-border" muted controls />
                    ) : (
                      <img src={editing.media_url} alt="Prévia da mídia" className="size-20 rounded-lg object-cover border border-border" />
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ ...editing, media_url: null })}>
                      <X className="size-4 mr-1" /> Remover
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <label className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input ${uploading ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}>
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                      {uploading ? "Enviando..." : "Anexar imagem ou vídeo"}
                      <input type="file" accept="image/*,video/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">A mídia é enviada junto com a mensagem (a mensagem vira a legenda). Vídeo até 16MB.</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Filtrar por tags do CRM</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag criada ainda — vazio = todos os contatos.</span>}
                  {tags.map((t) => {
                    const on = (editing.filtro_tags ?? []).includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => {
                          const next = on ? editing.filtro_tags.filter((x: string) => x !== t) : [...(editing.filtro_tags ?? []), t];
                          setEditing({ ...editing, filtro_tags: next });
                          void calcPreview(next);
                        }}
                        className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                <Button type="button" variant="link" size="sm" className="px-0 mt-1" onClick={() => calcPreview(editing.filtro_tags ?? [])}>
                  Calcular público alvo
                </Button>
                {preview && <p className="text-xs">{preview.total} contatos serão impactados.</p>}
              </div>
              <div>
                <Label>Agendar para (opcional)</Label>
                <Input type="datetime-local" value={editing.agendado_para ? String(editing.agendado_para).slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, agendado_para: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Intervalo mín. (seg)</Label>
                  <Input type="number" min={2} value={editing.intervalo_min_seg} onChange={(e) => setEditing({ ...editing, intervalo_min_seg: e.target.value })} />
                </div>
                <div>
                  <Label>Intervalo máx. (seg)</Label>
                  <Input type="number" min={2} value={editing.intervalo_max_seg} onChange={(e) => setEditing({ ...editing, intervalo_max_seg: e.target.value })} />
                </div>
                <div>
                  <Label>Pausa a cada N envios</Label>
                  <Input type="number" min={10} value={editing.pausa_apos_envios} onChange={(e) => setEditing({ ...editing, pausa_apos_envios: e.target.value })} />
                </div>
                <div>
                  <Label>Duração da pausa (min)</Label>
                  <Input type="number" min={1} value={editing.pausa_duracao_min} onChange={(e) => setEditing({ ...editing, pausa_duracao_min: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Anti-ban: intervalo aleatório entre envios e pausa longa periódica protegem seu número.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
