import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { ativarTeste, continuarMontagem, CRIATIVOS_TESTE, montarTeste, ORCAMENTO_TOTAL_CENTS, pausarTeste, resumoTeste } from "../src/teste_ap.ts";
import type { TesteEnv } from "../src/teste_ap.ts";
import { lerEstado } from "../src/agentes/gestor.ts";
import { calcularMetricas } from "../src/metricas.ts";

/**
 * Teste pago do Atendimento Pronto (src/teste_ap.ts): montar tudo pausado, continuar depois do vídeo processar,
 * ativar só com a frase, pausar, e o cartão do painel. Meta, arquivos e banco falsos.
 */

function d1Falso(db: DatabaseSync): D1Database {
  const prepare = (sqlD1: string) => {
    const numerado = /\?\d+/.test(sqlD1);
    const stmt = db.prepare(numerado ? sqlD1.replace(/\?(\d+)/g, "$p$1") : sqlD1);
    const comArgs = (lista: unknown[]) => {
      const args = numerado ? [Object.fromEntries(lista.map((v, i) => [`p${i + 1}`, v]))] : lista;
      return {
        all: async () => ({ results: stmt.all(...(args as never[])), success: true, meta: {} }),
        first: async () => stmt.get(...(args as never[])) ?? null,
        run: async () => { const r = stmt.run(...(args as never[])); return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
      };
    };
    return { ...comArgs([]), bind: (...args: unknown[]) => comArgs(args) };
  };
  return { prepare } as unknown as D1Database;
}

const MIGRACOES = ["0001_pagamento.sql", "0002_anuncios.sql", "0003_analista.sql", "0004_agentes.sql", "0005_criador.sql", "0006_biblioteca.sql", "0007_equipe.sql", "0008_negocio.sql", "0009_feedback_video.sql", "0010_referencia.sql", "0011_video_story.sql", "0012_teste_ap.sql"];

interface Chamada { metodo: string; caminho: string; corpo: Record<string, string> }

/** Meta falsa: devolve ids em sequência e guarda cada chamada. `videoPronto` decide o status do processamento. */
function metaFalsa(opts: { videoPronto?: () => boolean; semInstagram?: boolean; erroEm?: string; recusaInicio?: boolean; conta?: Record<string, unknown> } = {}) {
  const chamadas: Chamada[] = [];
  let n = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const caminho = url.pathname.replace(/^\/v\d+\.\d+\//, "") + (url.search ? url.search : "");
    const metodo = init?.method ?? "GET";
    let corpo: Record<string, string> = {};
    if (init?.body instanceof FormData) corpo = Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "(arquivo)"]));
    else if (typeof init?.body === "string") corpo = Object.fromEntries(new URLSearchParams(init.body));
    chamadas.push({ metodo, caminho, corpo });
    const resp = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
    n += 1;
    if (opts.erroEm && caminho.startsWith(opts.erroEm) && metodo === "POST") return resp({ error: { message: "Invalid parameter", code: 100, error_subcode: 1487, error_user_msg: "Mensagem de teste" } }, 400);
    if (opts.recusaInicio && corpo.start_time && !caminho.startsWith("act_")) return resp({ error: { message: "Start time can't be changed", code: 100 } }, 400);
    if (caminho.startsWith("act_123?fields=")) return resp({ id: "act_123", name: "Glowhaven Ads", currency: "BRL", account_status: 1, spend_cap: "0", amount_spent: "0", ...opts.conta });
    if (caminho.startsWith("p1?fields=instagram_business_account")) return resp(opts.semInstagram ? { id: "p1" } : { instagram_business_account: { id: "ig1" }, id: "p1" });
    if (caminho.startsWith("act_123/instagram_accounts")) return resp({ data: opts.semInstagram ? [] : [{ id: "ig1" }] });
    if (caminho.startsWith("search?")) {
      const q = url.searchParams.get("q") ?? "";
      return resp({ data: [{ id: `int-${q}`, name: q }, { id: `int-${q}-2`, name: `${q} (algo)` }] });
    }
    if (caminho === "act_123/adimages") return resp({ images: { [corpo.name ?? "x"]: { hash: `h${n}`, url: "https://x" } } });
    if (caminho === "act_123/advideos") return resp({ id: `vid${n}` });
    if (/^vid\d+\?fields=status/.test(caminho)) return resp({ status: { video_status: (opts.videoPronto?.() ?? true) ? "ready" : "processing" } });
    if (caminho === "act_123/campaigns" && metodo === "POST") return resp({ id: `camp${n}` });
    if (caminho === "act_123/adsets") return resp({ id: `as${n}` });
    if (caminho === "act_123/adcreatives") return resp({ id: `cr${n}` });
    if (caminho === "act_123/ads" && metodo === "POST") return resp({ id: `ad${n}` });
    if (metodo === "GET") return resp({ data: [] }); // coleta (insights, campanhas, anúncios)
    return resp({ success: true }); // atualização de status/datas
  }) as typeof fetch;
  return { fetchFn, chamadas };
}

function ambiente(extra: Partial<TesteEnv> = {}): { env: TesteEnv; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of MIGRACOES) sqlite.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), "utf8"));
  const arquivos = new Map<string, Uint8Array>([["/teste/v1.mp4", new Uint8Array([1, 2, 3])], ["/teste/v4.mp4", new Uint8Array([4, 5, 6])], ["/teste/img.png", new Uint8Array([7, 8])], ["/teste/v1-capa.jpg", new Uint8Array([9])], ["/teste/v4-capa.jpg", new Uint8Array([10])]]);
  const ASSETS = { fetch: async (r: Request | string | URL) => { const p = new URL(r instanceof Request ? r.url : String(r)).pathname; const b = arquivos.get(p); return b ? new Response(b) : new Response("não", { status: 404 }); } };
  return { env: { DB: d1Falso(sqlite), ASSETS, META_ADS_TOKEN: "tk", META_AD_ACCOUNT_ID: "123", META_PAGE_ID: "p1", META_VIDEO_ESPERA_MS: "0", ...extra }, sqlite };
}

const AGORA = new Date("2026-11-24T12:00:00Z");
const posts = (cs: Chamada[], caminho: string) => cs.filter((c) => c.metodo === "POST" && c.caminho === caminho);

test("montar cria as 3 campanhas PAUSADAS: Tráfego, orçamento total de R$ 54, só Instagram, link com utm", async () => {
  const { env } = ambiente();
  const { fetchFn, chamadas } = metaFalsa();
  const r = await montarTeste(env, fetchFn, AGORA);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.mensagem, /PAUSADAS/);
  const camps = posts(chamadas, "act_123/campaigns");
  assert.equal(camps.length, 3);
  for (const c of camps) { assert.equal(c.corpo.status, "PAUSED"); assert.equal(c.corpo.objective, "OUTCOME_TRAFFIC"); assert.equal(c.corpo.special_ad_categories, "[]"); }
  const conjuntos = posts(chamadas, "act_123/adsets");
  assert.equal(conjuntos.length, 3);
  for (const c of conjuntos) {
    assert.equal(c.corpo.status, "PAUSED");
    assert.equal(c.corpo.lifetime_budget, String(ORCAMENTO_TOTAL_CENTS));
    assert.equal(c.corpo.optimization_goal, "LINK_CLICKS");
    assert.equal(Date.parse(c.corpo.end_time) - Date.parse(c.corpo.start_time), 3 * 24 * 3600_000);
    const alvo = JSON.parse(c.corpo.targeting) as { publisher_platforms: string[]; genders: number[]; age_min: number; age_max: number; geo_locations: { countries: string[] }; flexible_spec: Array<{ interests: unknown[] }>; targeting_automation: { advantage_audience: number } };
    assert.deepEqual(alvo.publisher_platforms, ["instagram"]);
    assert.deepEqual(alvo.genders, [2]);
    assert.deepEqual(alvo.geo_locations.countries, ["BR"]);
    assert.equal(alvo.age_min, 20); assert.equal(alvo.age_max, 45);
    assert.ok(alvo.flexible_spec[0].interests.length >= 2);
    assert.equal(alvo.targeting_automation.advantage_audience, 0);
  }
  const criativos = posts(chamadas, "act_123/adcreatives");
  assert.equal(criativos.length, 3);
  for (const [i, c] of criativos.entries()) {
    const spec = JSON.parse(c.corpo.object_story_spec) as { page_id: string; instagram_user_id: string; video_data?: { call_to_action: { value: { link: string } }; image_hash: string }; link_data?: { link: string } };
    assert.equal(spec.page_id, "p1");
    assert.equal(spec.instagram_user_id, "ig1");
    const link = spec.video_data?.call_to_action.value.link ?? spec.link_data?.link ?? "";
    assert.equal(link, `https://atendimentopronto.netlify.app/?utm_source=${CRIATIVOS_TESTE[i].utm}`);
    if (spec.video_data) assert.ok(spec.video_data.image_hash, "vídeo leva miniatura");
    assert.ok(c.corpo.degrees_of_freedom_spec?.includes("OPT_OUT"), "sem aprimoramentos automáticos");
  }
  const anuncios = posts(chamadas, "act_123/ads");
  assert.equal(anuncios.length, 3);
  for (const a of anuncios) assert.equal(a.corpo.status, "PAUSED");
  assert.equal(chamadas.filter((c) => c.corpo.status === "ACTIVE").length, 0, "nada é ativado ao montar");
  assert.equal(posts(chamadas, "act_123/advideos").length, 2);

  // rodar de novo não cria nada (só relê a conta)
  const antes = chamadas.length;
  const r2 = await montarTeste(env, fetchFn, AGORA);
  assert.equal(r2.ok, true);
  assert.equal(chamadas.slice(antes).filter((c) => c.metodo === "POST").length, 0);
  const res = await resumoTeste(env.DB, AGORA);
  assert.equal(res.pronto_para_ativar, true);
  assert.equal(res.maximo_cents, 16_200);
});

test("vídeo ainda processando: imagem fica pronta, vídeos esperam e o cron termina sem duplicar", async () => {
  const { env } = ambiente();
  let pronto = false;
  const { fetchFn, chamadas } = metaFalsa({ videoPronto: () => pronto });
  const r = await montarTeste(env, fetchFn, AGORA, 0);
  assert.equal(r.ok, true);
  assert.match(r.mensagem, /1 de 3/);
  assert.equal(posts(chamadas, "act_123/campaigns").length, 1, "campanha de vídeo só nasce com o vídeo pronto");
  pronto = true;
  const r2 = await continuarMontagem(env, fetchFn);
  assert.ok(r2 && r2.ok);
  assert.equal(posts(chamadas, "act_123/campaigns").length, 3);
  assert.equal(posts(chamadas, "act_123/advideos").length, 2, "não sobe o vídeo de novo");
  assert.equal(await continuarMontagem(env, fetchFn), null, "nada esperando: o cron não faz nada");
});

test("sem Instagram ligado à página nem à conta, não cria nada", async () => {
  const { env } = ambiente();
  const { fetchFn, chamadas } = metaFalsa({ semInstagram: true });
  const r = await montarTeste(env, fetchFn, AGORA);
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /Instagram/);
  assert.equal(chamadas.filter((c) => c.metodo === "POST").length, 0);
});

test("erro da Meta fica registrado com a mensagem e montar de novo continua do ponto", async () => {
  const { env, sqlite } = ambiente();
  const m1 = metaFalsa({ erroEm: "act_123/adsets" });
  const r = await montarTeste(env, m1.fetchFn, AGORA);
  assert.equal(r.ok, false);
  const linha = sqlite.prepare("SELECT status, erro, campanha_id, conjunto_id FROM teste_ap WHERE chave = 'img'").get() as { status: string; erro: string; campanha_id: string; conjunto_id: string | null };
  assert.equal(linha.status, "erro");
  assert.match(linha.erro, /conjunto: HTTP 400 \(código 100\/1487\): Mensagem de teste/);
  assert.ok(linha.campanha_id && !linha.conjunto_id);
  const m2 = metaFalsa();
  const r2 = await montarTeste(env, m2.fetchFn, AGORA);
  assert.equal(r2.ok, true);
  assert.equal(posts(m2.chamadas, "act_123/campaigns").length, 0, "reaproveita as campanhas já criadas");
  assert.equal(posts(m2.chamadas, "act_123/adsets").length, 3);
});

test("ativar só com a frase e com as 3 pausadas; liga anúncio, conjunto e campanha e põe o time na guarda", async () => {
  const { env, sqlite } = ambiente();
  const { fetchFn, chamadas } = metaFalsa();
  const cedo = await ativarTeste(env, "pode ativar", "vitor", fetchFn, AGORA);
  assert.equal(cedo.ok, false, "nada montado ainda");
  await montarTeste(env, fetchFn, AGORA);
  const n0 = chamadas.length;
  const errado = await ativarTeste(env, "pode", "vitor", fetchFn, AGORA);
  assert.equal(errado.ok, false);
  assert.equal(chamadas.length, n0, "frase errada não chama a Meta");
  const r = await ativarTeste(env, "  Pode Ativar ", "vitor@x.com", fetchFn, AGORA);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(Date.parse(r.fim!) - Date.parse(r.inicio!), 3 * 24 * 3600_000);
  const ativacoes = chamadas.slice(n0).filter((c) => c.metodo === "POST" && c.corpo.status === "ACTIVE");
  assert.equal(ativacoes.length, 9, "anúncio, conjunto e campanha dos 3");
  const datas = chamadas.slice(n0).filter((c) => c.metodo === "POST" && c.corpo.start_time);
  assert.equal(datas.length, 3);
  assert.ok(Date.parse(datas[0].corpo.start_time) > AGORA.getTime(), "começa depois de agora");
  const st = sqlite.prepare("SELECT COUNT(*) AS n FROM teste_ap WHERE status = 'ativo'").get() as { n: number };
  assert.equal(st.n, 3);
  const estado = await lerEstado(env.DB);
  assert.equal(estado.vigia.nivel, 2);
  assert.equal(estado.gestor.nivel, 2);
  assert.equal(estado.analista.nivel, 1);
  assert.equal(estado.criador.nivel, 0);
  const res = await resumoTeste(env.DB, AGORA);
  assert.equal(res.ativo, true);
  const depois = await resumoTeste(env.DB, new Date(AGORA.getTime() + 4 * 24 * 3600_000));
  assert.equal(depois.ativo, false);
  assert.ok(depois.linhas.every((l) => l.estado === "terminou"));
  const de_novo = await montarTeste(env, fetchFn, AGORA);
  assert.equal(de_novo.ok, false, "montar não mexe no teste ativo");
});

test("ativar: se a Meta não deixar mudar o começo, muda só o fim e liga igual; sem conseguir o fim, não liga nada", async () => {
  const { env, sqlite } = ambiente();
  const m = metaFalsa({ recusaInicio: true });
  await montarTeste(env, m.fetchFn, AGORA);
  const n0 = m.chamadas.length;
  const r = await ativarTeste(env, "pode ativar", "vitor", m.fetchFn, AGORA);
  assert.equal(r.ok, true, JSON.stringify(r));
  const soFim = m.chamadas.slice(n0).filter((c) => c.metodo === "POST" && c.corpo.end_time && !c.corpo.start_time);
  assert.equal(soFim.length, 3, "um só-fim por conjunto");
  assert.equal(m.chamadas.slice(n0).filter((c) => c.metodo === "POST" && c.corpo.status === "ACTIVE").length, 9);

  const outro = ambiente();
  const m2 = metaFalsa();
  await montarTeste(outro.env, m2.fetchFn, AGORA);
  const recusaDatas = (async (input: string | URL | Request, init?: RequestInit) => {
    const corpo = typeof init?.body === "string" ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    if (corpo.end_time) return new Response(JSON.stringify({ error: { message: "End time inválido", code: 100 } }), { status: 400 });
    return m2.fetchFn(input, init);
  }) as typeof fetch;
  const n1 = m2.chamadas.length;
  const r2 = await ativarTeste(outro.env, "pode ativar", "vitor", recusaDatas, AGORA);
  assert.equal(r2.ok, false);
  assert.equal(m2.chamadas.slice(n1).filter((c) => c.metodo === "POST" && c.corpo.status === "ACTIVE").length, 0, "sem datas certas, nada é ligado");
  assert.equal((outro.sqlite.prepare("SELECT COUNT(*) AS n FROM teste_ap WHERE status = 'erro'").get() as { n: number }).n, 3);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM teste_ap WHERE status = 'ativo'").get() as { n: number }).n, 3, "no primeiro caso as 3 ficaram no ar");
});

test("conta em outra moeda ou desativada: não monta nada; limite de gastos curto: monta e avisa", async () => {
  const dolar = metaFalsa({ conta: { currency: "USD" } });
  const r1 = await montarTeste(ambiente().env, dolar.fetchFn, AGORA);
  assert.equal(r1.ok, false);
  assert.match(r1.mensagem, /USD/);
  assert.equal(dolar.chamadas.filter((c) => c.metodo === "POST").length, 0);

  const parada = metaFalsa({ conta: { account_status: 2 } });
  const r2 = await montarTeste(ambiente().env, parada.fetchFn, AGORA);
  assert.equal(r2.ok, false);
  assert.match(r2.mensagem, /não está ativa/);
  assert.equal(parada.chamadas.filter((c) => c.metodo === "POST").length, 0);

  // limite de R$ 165 com R$ 74,27 já usados: sobra R$ 90,73, menos que os R$ 162 do teste
  const { env } = ambiente();
  const curta = metaFalsa({ conta: { spend_cap: "16500", amount_spent: "7427" } });
  const r3 = await montarTeste(env, curta.fetchFn, AGORA);
  assert.equal(r3.ok, true);
  assert.match(r3.mensagem, /PAUSADAS/);
  assert.match(r3.mensagem, /só deixa gastar mais R\$ 90,73/);
  const r4 = await ativarTeste(env, "pode ativar", "vitor", curta.fetchFn, AGORA);
  assert.equal(r4.ok, true);
  assert.match(r4.mensagem, /R\$ 90,73/);

  // limite folgado: sem aviso
  const folga = metaFalsa({ conta: { spend_cap: "50000", amount_spent: "7427" } });
  const r5 = await montarTeste(ambiente().env, folga.fetchFn, AGORA);
  assert.doesNotMatch(r5.mensagem, /Atenção/);
});

test("pausar pausa as 3 campanhas e deixa pronto para ativar de novo", async () => {
  const { env } = ambiente();
  const { fetchFn, chamadas } = metaFalsa();
  await montarTeste(env, fetchFn, AGORA);
  await ativarTeste(env, "pode ativar", "vitor", fetchFn, AGORA);
  const n0 = chamadas.length;
  const r = await pausarTeste(env, fetchFn, AGORA);
  assert.equal(r.ok, true);
  const pausas = chamadas.slice(n0).filter((c) => c.metodo === "POST" && c.corpo.status === "PAUSED");
  assert.equal(pausas.length, 3);
  assert.ok(pausas.every((p) => p.caminho.startsWith("camp")));
  assert.equal((await resumoTeste(env.DB, AGORA)).pronto_para_ativar, true);
});

test("painel: cartão do teste com montar, depois ativar (com a frase), depois pausar; leitor não vê botões", async () => {
  const { paginaPainel } = await import("../src/painel.ts");
  const { env } = ambiente();
  const { fetchFn } = metaFalsa();
  const vazio = calcularMetricas([], [], AGORA);
  const extras = async () => ({ eventos: { por_status: [], ultimos_erros: [] }, eventos_ativos: false, ingestao: { ultimos: [], clientes: 0, pagamentos: 0, com_clique: 0 }, teste: await resumoTeste(env.DB, AGORA) });
  const admin = { email: "vitor@x.com", nome: "Vitor", papel: "admin" as const };
  const h0 = paginaPainel({}, vazio, await extras(), admin, "");
  assert.ok(h0.includes('id="teste"') && h0.includes("Teste pago") && h0.includes('action="/painel/teste/montar"') && h0.includes("não montado"));
  await montarTeste(env, fetchFn, AGORA);
  const h1 = paginaPainel({}, vazio, await extras(), admin, "?token=t");
  assert.ok(h1.includes('action="/painel/teste/ativar?token=t"') && h1.includes('name="frase"') && h1.includes("pode ativar") && h1.includes("montado e pausado"));
  assert.ok(!h1.includes('action="/painel/teste/montar'));
  assert.ok(h1.includes("R$ 85,05"), "explica o teto do Vigia");
  await ativarTeste(env, "pode ativar", "vitor", fetchFn, AGORA);
  const h2 = paginaPainel({}, vazio, await extras(), admin, "");
  assert.ok(h2.includes('action="/painel/teste/pausar"') && h2.includes("no ar") && !h2.includes('name="frase"'));
  const leitor = paginaPainel({}, vazio, await extras(), { email: "l@x.com", nome: "L", papel: "leitor" }, "");
  assert.ok(leitor.includes("Teste pago") && !leitor.includes("/painel/teste/pausar"));
});
