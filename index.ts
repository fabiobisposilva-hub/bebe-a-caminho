// BeBê a CaMinHo – função "bom-dia" (Supabase Edge Function)
// Todo dia às 9h (horário de Brasília) o agendador do banco chama esta função.
// Ela manda a mensagem do dia, como notificação, só para as mães que ativaram no app.
// Desenvolvido por Fabio Bispo · novembro de 2026
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
function serviceKey(): string {
  if (env("SUPABASE_SERVICE_ROLE_KEY")) return env("SUPABASE_SERVICE_ROLE_KEY");
  try { const k = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); return k.default || Object.values(k)[0] as string || ""; } catch { return ""; }
}

/* ---------- datas no fuso de Brasília ---------- */
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dayDiff = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86400000);
const addDays = (iso: string, n: number) => new Date(ms(iso) + n * 86400000).toISOString().slice(0, 10);
const first = (s: string) => (s || "").trim().split(/\s+/)[0] || "";

/* ---------- mesma montagem de texto do app ---------- */
type Msg = { t: string; k: string; f?: string; pre?: string };
type Bebe = { id: string; nome: string; dpp: string | null; nasc: string | null; sexo: string };
function fill(t: string, sexo: string) {
  return t.replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, fem, masc) => sexo === "F" ? fem : sexo === "M" ? masc : `${masc}(${fem})`);
}
function compose(m: Msg, b: Bebe) {
  let t = fill(m.t, b.sexo || "");
  if (m.k === "dica" || m.k === "dicab" || m.k === "dicam") t = "Dica de cuidado: " + t;
  if (m.pre) t = m.pre + "\n\n" + t;
  if (m.k === "voz") t += "\n— Com amor, " + (first(b.nome) || "seu bebê");
  return t;
}
function estado(b: Bebe, hoje: string, BD: { gest: Msg[]; pos: Msg[] }) {
  if (b.nasc) {
    const d = dayDiff(b.nasc, hoje);
    if (d < 0 || d > 90) return null;
    const nome = first(b.nome) || "O bebê";
    return { m: BD.pos[d], sub: d === 0 ? nome + " nasceu hoje 💚" : nome + " tem " + d + (d === 1 ? " dia" : " dias") };
  }
  if (!b.dpp) return null;
  const g = dayDiff(addDays(b.dpp, -280), hoje);
  if (g < 0 || g > 294) return null;
  const f = dayDiff(hoje, b.dpp), nome = first(b.nome) || "o bebê";
  const cont = f > 1 ? "faltam " + f + " dias para conhecer " + nome : f === 1 ? "falta 1 dia para a data provável" : f === 0 ? "hoje é a data provável!" : nome + " pode chegar a qualquer momento";
  return { m: BD.gest[g], sub: Math.floor(g / 7) + "ª semana · " + cont };
}

/* ---------- envio ---------- */
type Sub = { endpoint: string; user_id: string; familia_id: string; p256dh: string; auth: string };
async function enviar(sub: Sub, payload: unknown): Promise<number> {
  const det = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { vapidDetails: { subject: env("VAPID_SUBJECT") || env("APP_URL"), publicKey: env("VAPID_PUBLIC_KEY"), privateKey: env("VAPID_PRIVATE_KEY") }, TTL: 6 * 3600 },
  );
  const r = await fetch(det.endpoint, { method: det.method, headers: det.headers as Record<string, string>, body: det.body });
  await r.body?.cancel();
  return r.status;
}

export async function rodar(sb: any, BD: { gest: Msg[]; pos: Msg[] }, hoje: string, teste: boolean, send = enviar) {
  const res = { hoje, enviadas: 0, puladas: 0, removidas: 0, erros: [] as string[] };
  const { data: subs, error } = await sb.from("push_subs").select("*").eq("ativo", true);
  if (error) throw error;
  for (const sub of (subs || []) as Sub[]) {
    try {
      const { data: perfil } = await sb.from("perfis").select("nome,papel").eq("id", sub.user_id).maybeSingle();
      const { data: membro } = await sb.from("membros").select("papel,status").eq("familia_id", sub.familia_id).eq("user_id", sub.user_id).maybeSingle();
      /* só a mãe, responsável e aprovada na família */
      if (!perfil || !/^m[aã]e$/i.test((perfil.papel || "").trim()) || !membro || membro.papel !== "responsavel" || membro.status !== "aprovado") { res.puladas++; continue; }
      const { data: bebes } = await sb.from("bebes").select("id,nome,dpp,nasc,sexo").eq("familia_id", sub.familia_id).order("ordem");
      let est = null, bebe: Bebe | null = null;
      for (const b of (bebes || []) as Bebe[]) { est = estado(b, hoje, BD); if (est) { bebe = b; break; } }
      if (!est || !bebe || !est.m) { res.puladas++; continue; }
      if (!teste) {
        const { error: dup } = await sb.from("bomdia_envios").insert({ endpoint: sub.endpoint, dia: hoje });
        if (dup) { res.puladas++; continue; } /* já enviada hoje */
      }
      const st = await send(sub, {
        title: "☀️ Bom dia, " + (first(perfil.nome) || "mamãe") + "!",
        body: compose(est.m, bebe) + "\n(" + est.sub + ")",
        url: env("APP_URL") || "/", tag: "bom-dia-" + hoje,
      });
      if (st === 404 || st === 410) { await sb.from("push_subs").delete().eq("endpoint", sub.endpoint); res.removidas++; }
      else if (st >= 200 && st < 300) res.enviadas++;
      else {
        res.erros.push("status " + st);
        /* falhou: libera o dia para uma nova tentativa */
        if (!teste) await sb.from("bomdia_envios").delete().eq("endpoint", sub.endpoint).eq("dia", hoje);
      }
    } catch (e) { res.erros.push(String((e as Error)?.message || e).slice(0, 160)); }
  }
  return res;
}

Deno.serve(async (req) => {
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("proibido", { status: 403 });
  try {
    const teste = new URL(req.url).searchParams.get("teste") === "1";
    const sb = (globalThis as any).__sbTeste ?? createClient(env("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false } });
    const BD = await (await fetch(env("APP_URL").replace(/\/$/, "") + "/mensagens.json?v=" + Date.now())).json();
    const r = await rodar(sb, BD, hojeSP(), teste);
    return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
