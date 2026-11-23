import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { campanhaDoNegocio, varrerGasto } from "../src/anuncios.ts";
import { gastoHoje, rodarVigia } from "../src/agentes/vigia.ts";
import { gravarEstado, rodarGestor } from "../src/agentes/gestor.ts";

/**
 * Conta de anúncios dividida (META_CAMPANHA_PREFIXO): o Atendimento Pronto roda na conta da Glowhaven, e o time só
 * enxerga e só mexe nas campanhas "AP · ...". Coleta, Vigia e Gestor com Meta e banco falsos.
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

function banco(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of MIGRACOES) sqlite.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), "utf8"));
  return { db: d1Falso(sqlite), sqlite };
}

const AP = "AP · Teste BF · Vídeo 1 · 23h47";
const GH = "Glowhaven Heated Scarf · ATC";
const resp = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });

/** Meta falsa de uma conta com uma campanha de cada negócio. `gastoHojeAp`/`gastoHojeGh` em reais. */
function metaConta(opts: { gastoHojeAp?: string; gastoHojeGh?: string } = {}) {
  const chamadas: Array<{ metodo: string; url: string; corpo: string }> = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, url, corpo: String(init?.body ?? "") });
    if (metodo === "POST") return resp({ success: true });
    if (url.includes("/insights?") && url.includes("date_preset=today") && url.includes("level=campaign")) {
      return resp({ data: [{ campaign_id: "A1", campaign_name: AP, spend: opts.gastoHojeAp ?? "20.00" }, { campaign_id: "G1", campaign_name: GH, spend: opts.gastoHojeGh ?? "500.00" }] });
    }
    if (url.includes("/insights?") && url.includes("date_preset=today")) return resp({ data: [{ spend: "520.00" }] });
    if (url.includes("/insights?") && url.includes("level=ad")) return resp({ data: [{ date_start: "2026-11-24", ad_id: "ad1", spend: "10.00", impressions: "500", inline_link_clicks: "9" }, { date_start: "2026-11-24", ad_id: "ad2", spend: "70.00", impressions: "900", inline_link_clicks: "30" }] });
    if (url.includes("/insights?")) return resp({ data: [{ date_start: "2026-11-24", campaign_id: "A1", campaign_name: AP, spend: "10.00", impressions: "500", inline_link_clicks: "9" }, { date_start: "2026-11-24", campaign_id: "G1", campaign_name: GH, spend: "70.00", impressions: "900", inline_link_clicks: "30" }] });
    if (url.includes("/campaigns?")) return resp({ data: [{ id: "A1", name: AP, effective_status: "ACTIVE", objective: "OUTCOME_TRAFFIC" }, { id: "G1", name: GH, effective_status: "ACTIVE", daily_budget: "7500", objective: "OUTCOME_SALES" }] });
    if (url.includes("/ads?") && url.includes("DISAPPROVED")) {
      return resp({ data: [{ id: "ad1", name: "AP · Teste BF · Vídeo 1", effective_status: "DISAPPROVED", issues_info: [{ error_summary: "Texto" }], campaign: { name: AP } }, { id: "ad2", name: "Cachecol v11", effective_status: "WITH_ISSUES", issues_info: [{ error_summary: "Pixel" }], campaign: { name: GH } }] });
    }
    if (url.includes("/ads?")) return resp({ data: [{ id: "ad1", name: "AP · Teste BF · Vídeo 1", effective_status: "ACTIVE", campaign_id: "A1", adset_id: "s1", creative: { id: "c1" } }, { id: "ad2", name: "Cachecol v11", effective_status: "ACTIVE", campaign_id: "G1", adset_id: "s2", creative: { id: "c2" } }] });
    return resp({ data: [] });
  }) as typeof fetch;
  return { fetchFn, chamadas };
}

const AGORA = new Date("2026-11-24T15:00:00Z");
const conta = (extra: Record<string, string> = {}) => ({ META_ADS_TOKEN: "tk", META_AD_ACCOUNT_ID: "123", META_CAMPANHA_PREFIXO: "AP ·", ...extra });

test("prefixo: só campanhas que começam com ele; sem prefixo, todas", () => {
  assert.equal(campanhaDoNegocio({ META_CAMPANHA_PREFIXO: "AP ·" }, AP), true);
  assert.equal(campanhaDoNegocio({ META_CAMPANHA_PREFIXO: "AP ·" }, GH), false);
  assert.equal(campanhaDoNegocio({ META_CAMPANHA_PREFIXO: "AP ·" }, null), false);
  assert.equal(campanhaDoNegocio({ META_CAMPANHA_PREFIXO: " AP · " }, `  ${AP}`), true, "espaços nas pontas não contam");
  assert.equal(campanhaDoNegocio({}, GH), true);
  assert.equal(campanhaDoNegocio({ META_CAMPANHA_PREFIXO: "" }, GH), true);
});

test("coleta numa conta dividida grava só as campanhas e os anúncios do Atendimento Pronto", async () => {
  const { db, sqlite } = banco();
  const { fetchFn } = metaConta();
  const r = await varrerGasto({ DB: db, ...conta() }, fetchFn, AGORA);
  assert.deepEqual(r.meta, { linhas: 1, campanhas: 1, anuncios: 1, linhas_anuncio: 1 });
  const campanhas = sqlite.prepare("SELECT campanha_id FROM ads_campanhas").all() as Array<{ campanha_id: string }>;
  assert.deepEqual(campanhas.map((c) => c.campanha_id), ["A1"]);
  const gasto = sqlite.prepare("SELECT campanha_id, gasto_cents FROM ads_gasto_diario").all() as Array<{ campanha_id: string; gasto_cents: number }>;
  assert.deepEqual(gasto.map((g) => [g.campanha_id, g.gasto_cents]), [["A1", 1000]]);
  const anuncios = sqlite.prepare("SELECT anuncio_id FROM ads_anuncios").all() as Array<{ anuncio_id: string }>;
  assert.deepEqual(anuncios.map((a) => a.anuncio_id), ["ad1"]);
  const diario = sqlite.prepare("SELECT anuncio_id FROM ads_anuncio_diario").all() as Array<{ anuncio_id: string }>;
  assert.deepEqual(diario.map((a) => a.anuncio_id), ["ad1"]);

  // sem prefixo (conta só deste negócio), como antes: tudo entra
  const outro = banco();
  const r2 = await varrerGasto({ DB: outro.db, META_ADS_TOKEN: "tk", META_AD_ACCOUNT_ID: "123" }, metaConta().fetchFn, AGORA);
  assert.deepEqual(r2.meta, { linhas: 2, campanhas: 2, anuncios: 2, linhas_anuncio: 2 });
});

test("Vigia numa conta dividida: soma só o gasto do Atendimento Pronto, só pausa as campanhas dele e só avisa dos anúncios dele", async () => {
  const { db, sqlite } = banco();
  const env = { DB: db, ...conta() };
  // a Glowhaven gastando R$ 500 hoje não conta: o Atendimento Pronto gastou R$ 20
  assert.equal(await gastoHoje(env, metaConta().fetchFn), 2000);
  assert.equal(await gastoHoje({ DB: db, META_ADS_TOKEN: "tk", META_AD_ACCOUNT_ID: "123" }, metaConta().fetchFn), 52000, "sem prefixo: a conta inteira");

  // as duas campanhas ativas no banco (a da Glowhaven entra à mão, para provar a segunda trava)
  for (const [id, nome] of [["A1", AP], ["G1", GH]]) sqlite.prepare("INSERT INTO ads_campanhas (plataforma, campanha_id, campanha, status, atualizado_em) VALUES ('meta', ?, ?, 'ACTIVE', 't')").run(id, nome);
  const calmo = await rodarVigia(env, "horario", 2, metaConta().fetchFn, AGORA);
  assert.equal(calmo.pausas_enfileiradas, 0, "R$ 20 do AP: abaixo do teto, mesmo com a Glowhaven em R$ 500");
  const alertas = sqlite.prepare("SELECT chave FROM alertas").all() as Array<{ chave: string }>;
  assert.deepEqual(alertas.map((a) => a.chave), ["problema:ad1"], "só o anúncio do AP com problema vira alerta");

  const caro = await rodarVigia(env, "horario", 2, metaConta({ gastoHojeAp: "90.00" }).fetchFn, AGORA);
  assert.equal(caro.pausas_enfileiradas, 1);
  const fila = sqlite.prepare("SELECT alvo_id, status FROM ads_acoes").all() as Array<{ alvo_id: string; status: string }>;
  assert.deepEqual(fila.map((f) => [f.alvo_id, f.status]), [["A1", "pendente"]], "pausa só a campanha do AP");
});

test("Gestor numa conta dividida recusa ação em campanha de outro negócio e executa a do Atendimento Pronto", async () => {
  const { db, sqlite } = banco();
  const env = { DB: db, ...conta() };
  await gravarEstado(db, "gestor", 2, false, "teste");
  sqlite.prepare("INSERT INTO ads_campanhas (plataforma, campanha_id, campanha, status, atualizado_em) VALUES ('meta', 'A1', ?, 'ACTIVE', 't')").run(AP);
  const inserir = sqlite.prepare("INSERT INTO ads_acoes (dia, origem, plataforma, alvo_tipo, alvo_id, alvo_nome, tipo, motivo, status, criado_em) VALUES ('2026-11-24', 'vigia', 'meta', 'campanha', ?, ?, 'pausar', 'teto', 'pendente', 't')");
  inserir.run("G1", GH);
  inserir.run("A1", AP);
  const m = metaConta();
  const g = await rodarGestor(env, m.fetchFn, AGORA);
  assert.equal(g.executadas, 1);
  assert.equal(g.recusadas, 1);
  const linhas = sqlite.prepare("SELECT alvo_id, status, recusa FROM ads_acoes ORDER BY id").all() as Array<{ alvo_id: string; status: string; recusa: string | null }>;
  assert.equal(linhas[0].status, "recusada");
  assert.match(String(linhas[0].recusa), /outro negócio/);
  assert.equal(linhas[1].status, "executada");
  const posts = m.chamadas.filter((c) => c.metodo === "POST");
  assert.equal(posts.length, 1);
  assert.match(posts[0].url, /\/A1$/, "só a campanha do AP recebe a pausa");
});
