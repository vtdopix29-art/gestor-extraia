/**
 * Teste pago do Atendimento Pronto (Black Friday de 2026). Os 3 criativos que o Vitor aprovou (Vídeo 1, Vídeo novo e
 * Imagem) entram cada um numa campanha própria de Tráfego (1 conjunto, 1 anúncio), para o Gestor e o Vigia cuidarem
 * de cada criativo pela campanha.
 *
 *   montar  → cria tudo PAUSADO na Meta. Cada conjunto tem orçamento TOTAL de R$ 54 por 3 dias (a Meta nunca gasta
 *             mais que o total). Rodar de novo continua de onde parou e não cria nada em dobro.
 *   ativar  → só com a frase "pode ativar" (o Vitor digita no painel). Começa daqui a 2 minutos e termina 3 dias
 *             depois, liga anúncio, conjunto e campanha, atualiza a lista de campanhas para o Vigia e deixa o time na
 *             guarda do teste: Vigia pausa de verdade se o dia passar do teto, Analista só sugere.
 *   pausar  → pausa as campanhas do teste.
 *
 * O site não tem pixel: a campanha otimiza por clique no link. Quem decide no fim são as vendas da Kiwify e os
 * catálogos montados por origem (utm_source) no painel do site.
 */
import { META_API_VERSAO } from "./meta_versao.ts";
import { APRIMORAMENTOS } from "./agentes/criador.ts";
import { gravarEstado } from "./agentes/gestor.ts";
import { varrerGasto } from "./anuncios.ts";
import { nowIso } from "./util.ts";

export interface TesteEnv {
  DB: D1Database;
  /** Arquivos de publico/ (wrangler.toml → [assets]). */
  ASSETS?: { fetch(input: Request | string | URL, init?: RequestInit): Promise<Response> };
  META_ADS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
  META_PAGE_ID?: string;
  META_IG_USER_ID?: string;
  /** Só para testes: espera entre as consultas do processamento do vídeo. */
  META_VIDEO_ESPERA_MS?: string;
}

export interface CriativoTeste {
  chave: "v1" | "v4" | "img";
  nome: string;
  tipo: "video" | "imagem";
  /** Caminho dentro de publico/. */
  arquivo: string;
  /** Vídeo: miniatura (JPG) dentro de publico/. */
  capa?: string;
  /** Texto principal do anúncio. */
  texto: string;
  /** Título (aparece no botão/rodapé em alguns posicionamentos). */
  titulo: string;
  /** utm_source que o painel do site lê. */
  utm: string;
}

export const SITE = "https://atendimentopronto.netlify.app/";
/** Orçamento total de cada criativo nos 3 dias (centavos). 3 × R$ 54 = R$ 162, mais o imposto da Meta. */
export const ORCAMENTO_TOTAL_CENTS = 5_400;
export const DIAS_TESTE = 3;
export const FRASE_ATIVAR = "pode ativar";
export const NOME_CAMPANHA = "AP · Teste BF";
/** Mínimo de interesses que a Meta precisa achar para montar (sem eles o público ficaria aberto demais). */
export const MIN_INTERESSES = 2;

export const PUBLICO_TESTE = {
  paises: ["BR"],
  idade_min: 20,
  idade_max: 45,
  /** 2 = mulheres. */
  generos: [2],
  interesses: ["Manicure", "Unhas de gel", "Nail art", "Esmalte", "Salão de beleza"],
  posicoes_instagram: ["stream", "story", "reels", "explore", "explore_home", "profile_feed"],
};

export const CRIATIVOS_TESTE: CriativoTeste[] = [
  {
    chave: "v1",
    nome: "Vídeo 1 · 23h47",
    tipo: "video",
    arquivo: "/teste/v1.mp4",
    capa: "/teste/v1-capa.jpg",
    texto: "Ela pergunta o preço às 23h47, você responde tudo e ela some? 👀\n\nTroque a listinha por um catálogo com os seus serviços e preços. Você monta pelo celular em 3 minutos, em 3 estilos.\n\nTeste grátis, sem criar conta (na versão grátis saem 4 páginas com selo). Plano Catálogo: R$ 10, pagamento único, todas as páginas sem o selo, em PDF e imagens.",
    titulo: "Teste grátis · Plano Catálogo R$ 10",
    utm: "ig-pago-v1",
  },
  {
    chave: "v4",
    nome: "Vídeo novo · Quanto você pagaria",
    tipo: "video",
    arquivo: "/teste/v4.mp4",
    capa: "/teste/v4-capa.jpg",
    texto: "Quanto você pagaria por esse catálogo? 👀\n\nCapa, sobre mim, formatos e os seus preços, em 3 estilos para escolher. Você monta pelo celular em 3 minutos.\n\nTeste grátis, sem criar conta (na versão grátis saem 4 páginas com selo). Plano Catálogo: R$ 10, pagamento único, todas as páginas sem o selo, em PDF e imagens.",
    titulo: "Teste grátis · Plano Catálogo R$ 10",
    utm: "ig-pago-v4",
  },
  {
    chave: "img",
    nome: "Imagem · Catálogo R$ 10",
    tipo: "imagem",
    arquivo: "/teste/img.png",
    texto: "Troque a listinha de preço por um catálogo 💅\n\nMonte pelo celular, com os seus serviços e preços, em 3 estilos. Teste grátis, sem criar conta (na versão grátis saem 4 páginas com selo).\n\nPlano Catálogo: R$ 10, pagamento único, todas as páginas sem o selo, em PDF e imagens.",
    titulo: "Seu catálogo de unhas em 3 minutos",
    utm: "ig-pago-img",
  },
];

export const linkDo = (c: Pick<CriativoTeste, "utm">): string => `${SITE}?utm_source=${encodeURIComponent(c.utm)}`;

export interface LinhaTeste {
  chave: string;
  nome: string;
  campanha_id: string | null;
  conjunto_id: string | null;
  midia_id: string | null;
  capa_hash: string | null;
  criativo_id: string | null;
  anuncio_id: string | null;
  instagram_id: string | null;
  publico_json: string | null;
  status: string;
  erro: string | null;
  inicio: string | null;
  fim: string | null;
  atualizado_em: string;
}

const API = `https://graph.facebook.com/${META_API_VERSAO}`;

interface RespMeta { ok: boolean; status: number; json: Record<string, unknown>; texto: string }

async function chamarMeta(env: TesteEnv, metodo: "GET" | "POST", caminho: string, corpo: Record<string, string> | FormData | null, fetchFn: typeof fetch): Promise<RespMeta> {
  const init: RequestInit = { method: metodo, headers: { accept: "application/json" } };
  if (corpo instanceof FormData) {
    corpo.append("access_token", env.META_ADS_TOKEN ?? "");
    init.body = corpo;
  } else {
    (init.headers as Record<string, string>).authorization = `Bearer ${env.META_ADS_TOKEN}`;
    if (corpo) {
      (init.headers as Record<string, string>)["content-type"] = "application/x-www-form-urlencoded";
      init.body = new URLSearchParams(corpo).toString();
    }
  }
  const res = await fetchFn(`${API}/${caminho}`, init);
  const texto = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(texto) as Record<string, unknown>; } catch { json = {}; }
  return { ok: res.ok, status: res.status, json, texto: texto.slice(0, 1000) };
}

/** Mensagem curta do erro da Meta (o texto para o usuário, quando ela manda, e os códigos). */
export function erroMeta(r: RespMeta): string {
  const e = r.json.error as { message?: string; error_user_title?: string; error_user_msg?: string; code?: number; error_subcode?: number } | undefined;
  if (!e) return `HTTP ${r.status}: ${r.texto.slice(0, 300)}`;
  const partes = [e.error_user_title, e.error_user_msg, e.message].filter((x): x is string => Boolean(x && x.trim()));
  return `HTTP ${r.status} (código ${e.code ?? "?"}${e.error_subcode ? `/${e.error_subcode}` : ""}): ${[...new Set(partes)].join(" · ").slice(0, 400)}`;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const norm = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Busca na Meta o id de cada interesse (nome igual primeiro; senão, o primeiro que contém o termo). */
export async function buscarInteresses(env: TesteEnv, termos: string[], fetchFn: typeof fetch): Promise<Array<{ id: string; name: string }>> {
  const achados: Array<{ id: string; name: string }> = [];
  for (const t of termos) {
    const r = await chamarMeta(env, "GET", `search?type=adinterest&q=${encodeURIComponent(t)}&limit=10&locale=pt_BR`, null, fetchFn);
    if (!r.ok) continue;
    const lista = ((r.json.data as Array<{ id?: unknown; name?: unknown }> | undefined) ?? []).filter((x) => x.id != null && typeof x.name === "string");
    const escolhido = lista.find((x) => norm(String(x.name)) === norm(t)) ?? lista.find((x) => norm(String(x.name)).includes(norm(t)));
    if (escolhido && !achados.some((a) => a.id === String(escolhido.id))) achados.push({ id: String(escolhido.id), name: String(escolhido.name) });
  }
  return achados;
}

/** Público do teste: nail designers no Brasil, só no Instagram, sem a Meta abrir o público sozinha. */
export function segmentacao(interesses: Array<{ id: string; name: string }>): Record<string, unknown> {
  return {
    geo_locations: { countries: PUBLICO_TESTE.paises },
    age_min: PUBLICO_TESTE.idade_min,
    age_max: PUBLICO_TESTE.idade_max,
    genders: PUBLICO_TESTE.generos,
    flexible_spec: [{ interests: interesses }],
    publisher_platforms: ["instagram"],
    instagram_positions: PUBLICO_TESTE.posicoes_instagram,
    device_platforms: ["mobile"],
    targeting_automation: { advantage_audience: 0 },
  };
}

/** Perfil do Instagram dos anúncios: o configurado, ou o ligado à página, ou o ligado à conta de anúncios. */
export async function perfilInstagram(env: TesteEnv, fetchFn: typeof fetch): Promise<string | null> {
  if (env.META_IG_USER_ID) return env.META_IG_USER_ID;
  const p = await chamarMeta(env, "GET", `${encodeURIComponent(env.META_PAGE_ID ?? "")}?fields=instagram_business_account`, null, fetchFn);
  const daPagina = (p.json.instagram_business_account as { id?: unknown } | undefined)?.id;
  if (p.ok && daPagina) return String(daPagina);
  const c = await chamarMeta(env, "GET", `act_${env.META_AD_ACCOUNT_ID}/instagram_accounts?fields=id,username`, null, fetchFn);
  const daConta = ((c.json.data as Array<{ id?: unknown }> | undefined) ?? [])[0]?.id;
  return c.ok && daConta ? String(daConta) : null;
}

async function lerArquivo(env: TesteEnv, caminho: string): Promise<Uint8Array | null> {
  if (!env.ASSETS) return null;
  const res = await env.ASSETS.fetch(new Request(`https://publico.local${caminho}`));
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

async function subirImagem(env: TesteEnv, bytes: Uint8Array, nome: string, fetchFn: typeof fetch): Promise<{ ok: true; hash: string } | { ok: false; erro: string }> {
  const r = await chamarMeta(env, "POST", `act_${env.META_AD_ACCOUNT_ID}/adimages`, { bytes: b64(bytes), name: nome }, fetchFn);
  const imgs = r.json.images as Record<string, { hash?: string }> | undefined;
  const hash = imgs ? Object.values(imgs)[0]?.hash : undefined;
  return r.ok && hash ? { ok: true, hash } : { ok: false, erro: `imagem: ${erroMeta(r)}` };
}

async function enviarVideo(env: TesteEnv, bytes: Uint8Array, nome: string, fetchFn: typeof fetch): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const fd = new FormData();
  fd.append("name", nome);
  fd.append("source", new Blob([bytes.slice().buffer], { type: "video/mp4" }), `${nome}.mp4`);
  const r = await chamarMeta(env, "POST", `act_${env.META_AD_ACCOUNT_ID}/advideos`, fd, fetchFn);
  const id = typeof r.json.id === "string" || typeof r.json.id === "number" ? String(r.json.id) : null;
  return r.ok && id ? { ok: true, id } : { ok: false, erro: `vídeo: ${erroMeta(r)}` };
}

/** ready, processing, error (ou desconhecido). */
async function statusVideo(env: TesteEnv, id: string, fetchFn: typeof fetch): Promise<string> {
  const r = await chamarMeta(env, "GET", `${encodeURIComponent(id)}?fields=status`, null, fetchFn);
  return (r.json.status as { video_status?: string } | undefined)?.video_status ?? "desconhecido";
}

async function esperarVideo(env: TesteEnv, id: string, fetchFn: typeof fetch, tentativas: number): Promise<string> {
  const espera = Number(env.META_VIDEO_ESPERA_MS ?? 4000);
  let st = await statusVideo(env, id, fetchFn);
  for (let i = 0; i < tentativas && st !== "ready" && st !== "error"; i++) {
    await new Promise((r) => setTimeout(r, espera));
    st = await statusVideo(env, id, fetchFn);
  }
  return st;
}

export async function lerLinhas(db: D1Database): Promise<LinhaTeste[]> {
  const r = await db.prepare("SELECT * FROM teste_ap").all<LinhaTeste>();
  const ordem = CRIATIVOS_TESTE.map((c) => c.chave);
  return r.results.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
}

const CAMPOS = ["campanha_id", "conjunto_id", "midia_id", "capa_hash", "criativo_id", "anuncio_id", "instagram_id", "publico_json", "status", "erro", "inicio", "fim"] as const;
type Campo = (typeof CAMPOS)[number];

async function gravar(db: D1Database, chave: string, mud: Partial<Record<Campo, string | null>>): Promise<void> {
  const ks = Object.keys(mud).filter((k): k is Campo => (CAMPOS as readonly string[]).includes(k));
  if (!ks.length) return;
  const sets = ks.map((k, i) => `${k} = ?${i + 2}`).join(", ");
  await db.prepare(`UPDATE teste_ap SET ${sets}, atualizado_em = ?${ks.length + 2} WHERE chave = ?1`).bind(chave, ...ks.map((k) => mud[k] ?? null), nowIso()).run();
}

export interface ResultadoMontar {
  ok: boolean;
  mensagem: string;
  detalhes: Array<{ chave: string; status: string; nota: string }>;
}

function faltaConfig(env: TesteEnv): string | null {
  if (!env.META_ADS_TOKEN) return "falta o segredo META_ADS_TOKEN (token do usuário do sistema)";
  if (!env.META_AD_ACCOUNT_ID) return "falta META_AD_ACCOUNT_ID (id da conta de anúncios Atendimento Pronto)";
  if (!env.META_PAGE_ID) return "falta META_PAGE_ID (id da página do Facebook Atendimento Pronto)";
  if (!env.ASSETS) return "faltam os arquivos do teste (wrangler.toml → [assets])";
  return null;
}

/**
 * Cria (ou termina de criar) as 3 campanhas PAUSADAS. Ordem por criativo: mídia → miniatura → vídeo pronto →
 * campanha → conjunto → criativo → anúncio. Assim nenhuma campanha fica vazia se a mídia falhar.
 */
export async function montarTeste(env: TesteEnv, fetchFn: typeof fetch = fetch, agora = new Date(), tentativasVideo = 10): Promise<ResultadoMontar> {
  const falta = faltaConfig(env);
  if (falta) return { ok: false, mensagem: `Não montei nada: ${falta}.`, detalhes: [] };
  for (const c of CRIATIVOS_TESTE) await env.DB.prepare("INSERT OR IGNORE INTO teste_ap (chave, nome, status, atualizado_em) VALUES (?1, ?2, 'novo', ?3)").bind(c.chave, c.nome, nowIso()).run();
  const linhas = new Map((await lerLinhas(env.DB)).map((l) => [l.chave, l]));
  if ([...linhas.values()].some((l) => l.status === "ativo")) return { ok: false, mensagem: "O teste já está ativo; não mexi em nada.", detalhes: [] };

  const precisaCriar = [...linhas.values()].some((l) => !l.anuncio_id);
  if (!precisaCriar) return { ok: true, mensagem: "As 3 campanhas já estão montadas e pausadas.", detalhes: [...linhas.values()].map((l) => ({ chave: l.chave, status: l.status, nota: "pronta" })) };

  const ig = [...linhas.values()].find((l) => l.instagram_id)?.instagram_id ?? (await perfilInstagram(env, fetchFn));
  if (!ig) return { ok: false, mensagem: "Não montei nada: não achei o Instagram @atendimento.pronto ligado à página nem à conta de anúncios. Ligue o perfil à página (Instagram > Editar perfil > Página) e dê ao usuário do sistema acesso ao perfil.", detalhes: [] };

  let publico = [...linhas.values()].find((l) => l.publico_json)?.publico_json ?? null;
  if (!publico) {
    const interesses = await buscarInteresses(env, PUBLICO_TESTE.interesses, fetchFn);
    if (interesses.length < MIN_INTERESSES) return { ok: false, mensagem: `Não montei nada: a Meta só achou ${interesses.length} dos interesses (${PUBLICO_TESTE.interesses.join(", ")}).`, detalhes: [] };
    publico = JSON.stringify(interesses);
  }
  const interesses = JSON.parse(publico) as Array<{ id: string; name: string }>;
  // o começo de verdade é marcado no "ativar"; até lá o conjunto fica pausado com uma data de amanhã
  const inicio = new Date(agora.getTime() + 24 * 3600_000);
  const fim = new Date(inicio.getTime() + DIAS_TESTE * 24 * 3600_000);
  const conta = `act_${env.META_AD_ACCOUNT_ID}`;
  const detalhes: ResultadoMontar["detalhes"] = [];

  for (const c of CRIATIVOS_TESTE) {
    const l = linhas.get(c.chave)!;
    if (l.anuncio_id) { detalhes.push({ chave: c.chave, status: l.status, nota: "já estava montado" }); continue; }
    const passo = async (mud: Partial<Record<Campo, string | null>>) => { Object.assign(l, mud); await gravar(env.DB, c.chave, mud); };
    const falhou = async (erro: string) => { await passo({ status: "erro", erro }); detalhes.push({ chave: c.chave, status: "erro", nota: erro }); };
    await passo({ instagram_id: ig, publico_json: publico, erro: null });

    // 1. mídia
    if (!l.midia_id) {
      const bytes = await lerArquivo(env, c.arquivo);
      if (!bytes) { await falhou(`arquivo ${c.arquivo} não encontrado`); continue; }
      if (c.tipo === "imagem") {
        const up = await subirImagem(env, bytes, `${c.chave}-${c.arquivo.split("/").pop()}`, fetchFn);
        if (!up.ok) { await falhou(up.erro); continue; }
        await passo({ midia_id: up.hash });
      } else {
        const up = await enviarVideo(env, bytes, `AP teste ${c.chave}`, fetchFn);
        if (!up.ok) { await falhou(up.erro); continue; }
        await passo({ midia_id: up.id, status: "aguardando_video" });
      }
    }
    // 2. miniatura do vídeo
    if (c.tipo === "video" && !l.capa_hash) {
      const bytes = c.capa ? await lerArquivo(env, c.capa) : null;
      if (!bytes) { await falhou(`miniatura ${c.capa ?? "(sem)"} não encontrada`); continue; }
      const up = await subirImagem(env, bytes, `${c.chave}-capa.jpg`, fetchFn);
      if (!up.ok) { await falhou(up.erro); continue; }
      await passo({ capa_hash: up.hash });
    }
    // 3. o criativo de vídeo só aceita vídeo pronto
    if (c.tipo === "video") {
      const st = await esperarVideo(env, l.midia_id!, fetchFn, tentativasVideo);
      if (st === "error") { await passo({ midia_id: null }); await falhou("a Meta não conseguiu processar o vídeo; montar de novo envia outra vez"); continue; }
      if (st !== "ready") { await passo({ status: "aguardando_video" }); detalhes.push({ chave: c.chave, status: "aguardando_video", nota: "a Meta ainda está processando o vídeo; continua sozinho em até 5 minutos" }); continue; }
    }
    // 4. campanha
    if (!l.campanha_id) {
      const r = await chamarMeta(env, "POST", `${conta}/campaigns`, { name: `${NOME_CAMPANHA} · ${c.nome}`, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: "[]", buying_type: "AUCTION", is_adset_budget_sharing_enabled: "false" }, fetchFn);
      const id = r.json.id == null ? null : String(r.json.id);
      if (!r.ok || !id) { await falhou(`campanha: ${erroMeta(r)}`); continue; }
      await passo({ campanha_id: id });
    }
    // 5. conjunto: orçamento total, 3 dias, nail designers no Instagram
    if (!l.conjunto_id) {
      const r = await chamarMeta(env, "POST", `${conta}/adsets`, {
        name: `${NOME_CAMPANHA} · ${c.nome} · nail designers`,
        campaign_id: l.campanha_id!,
        lifetime_budget: String(ORCAMENTO_TOTAL_CENTS),
        start_time: inicio.toISOString(),
        end_time: fim.toISOString(),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE",
        targeting: JSON.stringify(segmentacao(interesses)),
        status: "PAUSED",
      }, fetchFn);
      const id = r.json.id == null ? null : String(r.json.id);
      if (!r.ok || !id) { await falhou(`conjunto: ${erroMeta(r)}`); continue; }
      await passo({ conjunto_id: id });
    }
    // 6. criativo (sem os "aprimoramentos" automáticos da Meta: o anúncio sai como o Vitor aprovou)
    if (!l.criativo_id) {
      const link = linkDo(c);
      const cta = { type: "LEARN_MORE", value: { link } };
      const spec = c.tipo === "video"
        ? { page_id: env.META_PAGE_ID, instagram_user_id: ig, video_data: { video_id: l.midia_id, image_hash: l.capa_hash, message: c.texto, title: c.titulo, call_to_action: cta } }
        : { page_id: env.META_PAGE_ID, instagram_user_id: ig, link_data: { image_hash: l.midia_id, link, message: c.texto, name: c.titulo, call_to_action: cta } };
      const r = await chamarMeta(env, "POST", `${conta}/adcreatives`, { name: `${NOME_CAMPANHA} · ${c.nome}`, object_story_spec: JSON.stringify(spec), ...APRIMORAMENTOS }, fetchFn);
      const id = r.json.id == null ? null : String(r.json.id);
      if (!r.ok || !id) { await falhou(`criativo: ${erroMeta(r)}`); continue; }
      await passo({ criativo_id: id });
    }
    // 7. anúncio, pausado
    const r = await chamarMeta(env, "POST", `${conta}/ads`, { name: `${NOME_CAMPANHA} · ${c.nome}`, adset_id: l.conjunto_id!, creative: JSON.stringify({ creative_id: l.criativo_id }), status: "PAUSED" }, fetchFn);
    const id = r.json.id == null ? null : String(r.json.id);
    if (!r.ok || !id) { await falhou(`anúncio: ${erroMeta(r)}`); continue; }
    await passo({ anuncio_id: id, status: "pausado", erro: null });
    detalhes.push({ chave: c.chave, status: "pausado", nota: `campanha ${l.campanha_id}, anúncio ${id}` });
  }

  const finais = await lerLinhas(env.DB);
  const prontas = finais.filter((l) => l.status === "pausado").length;
  const erros = finais.filter((l) => l.status === "erro").length;
  const esperando = finais.filter((l) => l.status === "aguardando_video").length;
  const mensagem = prontas === CRIATIVOS_TESTE.length
    ? "As 3 campanhas estão montadas e PAUSADAS. Nada gasta até o \"pode ativar\"."
    : `${prontas} de ${CRIATIVOS_TESTE.length} montadas e pausadas${esperando ? `, ${esperando} esperando a Meta processar o vídeo` : ""}${erros ? `, ${erros} com erro (veja abaixo)` : ""}.`;
  return { ok: erros === 0, mensagem, detalhes };
}

/** Cron de 5 em 5 minutos: termina a montagem dos vídeos que esperavam a Meta. Sem nada esperando, uma consulta só. */
export async function continuarMontagem(env: TesteEnv, fetchFn: typeof fetch = fetch): Promise<ResultadoMontar | null> {
  const esperando = await env.DB.prepare("SELECT COUNT(*) AS n FROM teste_ap WHERE status = 'aguardando_video'").first<{ n: number }>().catch(() => null);
  if (!esperando || !Number(esperando.n)) return null;
  return montarTeste(env, fetchFn, new Date(), 3);
}

export interface ResultadoAtivar { ok: boolean; mensagem: string; inicio?: string; fim?: string; detalhes: Array<{ chave: string; status: string; nota: string }> }

/**
 * Liga o teste. Só com a frase exata e só se as 3 campanhas estiverem montadas e pausadas. Começa em 2 minutos e
 * termina em 3 dias (cada conjunto para sozinho no fim e nunca passa do orçamento total).
 */
export async function ativarTeste(env: TesteEnv, frase: string, quem: string, fetchFn: typeof fetch = fetch, agora = new Date()): Promise<ResultadoAtivar> {
  if (norm(frase) !== FRASE_ATIVAR) return { ok: false, mensagem: `Não ativei. Para ativar, digite exatamente "${FRASE_ATIVAR}".`, detalhes: [] };
  const falta = faltaConfig(env);
  if (falta) return { ok: false, mensagem: `Não ativei: ${falta}.`, detalhes: [] };
  const linhas = await lerLinhas(env.DB);
  if (linhas.length !== CRIATIVOS_TESTE.length || linhas.some((l) => l.status !== "pausado" || !l.anuncio_id)) {
    return { ok: false, mensagem: "Não ativei: as 3 campanhas precisam estar montadas e pausadas antes.", detalhes: linhas.map((l) => ({ chave: l.chave, status: l.status, nota: l.erro ?? "" })) };
  }
  const inicio = new Date(agora.getTime() + 2 * 60_000);
  const fim = new Date(inicio.getTime() + DIAS_TESTE * 24 * 3600_000);
  const detalhes: ResultadoAtivar["detalhes"] = [];
  for (const l of linhas) {
    let erro: string | null = null;
    // datas: começo daqui a 2 min e fim em 3 dias. Se a Meta não deixar mudar o começo (data de começo já passou),
    // muda só o fim: o orçamento total é o mesmo e ela distribui no tempo que sobra.
    const datas = await chamarMeta(env, "POST", encodeURIComponent(l.conjunto_id!), { start_time: inicio.toISOString(), end_time: fim.toISOString() }, fetchFn);
    if (!datas.ok) {
      const soFim = await chamarMeta(env, "POST", encodeURIComponent(l.conjunto_id!), { end_time: fim.toISOString() }, fetchFn);
      if (!soFim.ok) erro = `datas em ${l.conjunto_id}: ${erroMeta(datas)}`;
    }
    const passos: Array<[string, Record<string, string>]> = [
      [l.anuncio_id!, { status: "ACTIVE" }],
      [l.conjunto_id!, { status: "ACTIVE" }],
      [l.campanha_id!, { status: "ACTIVE" }],
    ];
    for (const [alvo, corpo] of erro ? [] : passos) {
      const r = await chamarMeta(env, "POST", encodeURIComponent(alvo), corpo, fetchFn);
      if (!r.ok) { erro = `${Object.keys(corpo).join("/")} em ${alvo}: ${erroMeta(r)}`; break; }
    }
    if (erro) { await gravar(env.DB, l.chave, { status: "erro", erro }); detalhes.push({ chave: l.chave, status: "erro", nota: erro }); continue; }
    await gravar(env.DB, l.chave, { status: "ativo", erro: null, inicio: inicio.toISOString(), fim: fim.toISOString() });
    detalhes.push({ chave: l.chave, status: "ativo", nota: `até ${fim.toISOString()}` });
  }
  const ativos = detalhes.filter((d) => d.status === "ativo").length;
  if (ativos > 0) {
    // time na guarda: o Vigia pausa de verdade (o Gestor executa só a fila, que nesta configuração é a pausa do
    // Vigia); o Analista continua só sugerindo; Criador e Públicos desligados.
    const por = `${quem} (ativou o teste no painel)`;
    await gravarEstado(env.DB, "vigia", 2, false, por);
    await gravarEstado(env.DB, "gestor", 2, false, por);
    await gravarEstado(env.DB, "analista", 1, false, por);
    await gravarEstado(env.DB, "criador", 0, false, por);
    await gravarEstado(env.DB, "publicos", 0, false, por);
    await varrerGasto(env, fetchFn, agora).catch(() => null);
  }
  const mensagem = ativos === linhas.length
    ? `Teste ativado: começa em 2 minutos e para sozinho em 3 dias. Máximo R$ ${(ORCAMENTO_TOTAL_CENTS * linhas.length / 100).toFixed(2).replace(".", ",")} mais o imposto da Meta.`
    : `Ativei ${ativos} de ${linhas.length}. Veja os erros abaixo.`;
  return { ok: ativos === linhas.length, mensagem, inicio: inicio.toISOString(), fim: fim.toISOString(), detalhes };
}

/** Pausa as campanhas do teste (o conjunto guarda o que já gastou; reativar nunca passa do orçamento total). */
export async function pausarTeste(env: TesteEnv, fetchFn: typeof fetch = fetch, agora = new Date()): Promise<ResultadoAtivar> {
  if (!env.META_ADS_TOKEN) return { ok: false, mensagem: "Não pausei: falta o segredo META_ADS_TOKEN.", detalhes: [] };
  const detalhes: ResultadoAtivar["detalhes"] = [];
  for (const l of await lerLinhas(env.DB)) {
    if (!l.campanha_id) continue;
    const r = await chamarMeta(env, "POST", encodeURIComponent(l.campanha_id), { status: "PAUSED" }, fetchFn);
    if (!r.ok) { detalhes.push({ chave: l.chave, status: "erro", nota: erroMeta(r) }); continue; }
    if (l.anuncio_id) await gravar(env.DB, l.chave, { status: "pausado" });
    detalhes.push({ chave: l.chave, status: "pausado", nota: `campanha ${l.campanha_id}` });
  }
  await varrerGasto(env, fetchFn, agora).catch(() => null);
  const erros = detalhes.filter((d) => d.status === "erro").length;
  return { ok: erros === 0, mensagem: erros ? `Pausei ${detalhes.length - erros}; ${erros} deram erro.` : "Campanhas do teste pausadas.", detalhes };
}

export interface ResumoTeste {
  /** estado = status, ou "terminou" quando o teste ativo já passou do fim. */
  linhas: Array<LinhaTeste & { link: string; tipo: string; estado: string; gasto_cents: number; cliques: number; impressoes: number }>;
  gasto_total_cents: number;
  maximo_cents: number;
  pronto_para_ativar: boolean;
  ativo: boolean;
}

/** O que o painel mostra: cada criativo, o estado e o que já gastou (da coleta diária e das horas do Vigia). */
export async function resumoTeste(db: D1Database, agora = new Date()): Promise<ResumoTeste> {
  const linhas = await lerLinhas(db).catch(() => [] as LinhaTeste[]);
  const out: ResumoTeste["linhas"] = [];
  for (const c of CRIATIVOS_TESTE) {
    const l = linhas.find((x) => x.chave === c.chave);
    const base: LinhaTeste = l ?? { chave: c.chave, nome: c.nome, campanha_id: null, conjunto_id: null, midia_id: null, capa_hash: null, criativo_id: null, anuncio_id: null, instagram_id: null, publico_json: null, status: "novo", erro: null, inicio: null, fim: null, atualizado_em: "" };
    let g = { gasto: 0, cliques: 0, impressoes: 0 };
    if (base.campanha_id) {
      const s = await db.prepare("SELECT COALESCE(SUM(gasto_cents), 0) AS gasto, COALESCE(SUM(cliques), 0) AS cliques, COALESCE(SUM(impressoes), 0) AS impressoes FROM ads_gasto_diario WHERE campanha_id = ?1").bind(base.campanha_id).first<{ gasto: number; cliques: number; impressoes: number }>();
      if (s) g = { gasto: Number(s.gasto) || 0, cliques: Number(s.cliques) || 0, impressoes: Number(s.impressoes) || 0 };
    }
    const terminou = base.status === "ativo" && base.fim != null && Date.parse(base.fim) < agora.getTime();
    out.push({ ...base, link: linkDo(c), tipo: c.tipo, estado: terminou ? "terminou" : base.status, gasto_cents: g.gasto, cliques: g.cliques, impressoes: g.impressoes });
  }
  return {
    linhas: out,
    gasto_total_cents: out.reduce((s, l) => s + l.gasto_cents, 0),
    maximo_cents: ORCAMENTO_TOTAL_CENTS * CRIATIVOS_TESTE.length,
    pronto_para_ativar: out.every((l) => l.status === "pausado" && l.anuncio_id),
    ativo: out.some((l) => l.estado === "ativo"),
  };
}
