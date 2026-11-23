# Gestor do Atendimento Pronto (ramo `atendimento-pronto`)

Cópia do Gestor só para o Atendimento Pronto. A ExtraIA continua no ramo `main`, com o Worker `gestor-extraia`.
Mesmo código, mas Worker, banco D1, bucket R2 e segredos separados. Não misturar.

**Conta de anúncios dividida.** Por decisão do Vitor (23/11), o teste roda na conta que ele já usa na Glowhaven
("Glowhaven Ads", `936746025890958`), que já tem pagamento e histórico. Com `META_CAMPANHA_PREFIXO = "AP ·"`, o time só
enxerga e só mexe nas campanhas cujo nome começa com "AP ·" (as do teste nascem "AP · Teste BF · ..."):

- a coleta grava só essas campanhas e os anúncios delas;
- o Vigia soma só o gasto delas no teto do dia, só pausa elas e só avisa de anúncio com problema nelas;
- o Gestor recusa qualquer ação em campanha de outro negócio, venha de onde vier.

As campanhas da Glowhaven ficam de fora de tudo. Quando o Atendimento Pronto tiver conta própria, basta trocar
`META_AD_ACCOUNT_ID` (e pode deixar o prefixo, ou apagar). Os eventos para a Meta (CAPI) ficam desligados: o pixel da
Glowhaven nunca recebe nada do Atendimento Pronto.

## O que muda em relação ao `main`

- `src/config/negocio.ts`: perfil, o que pode e o que não pode dizer, preço (R$ 10), venda única (`CICLO_DIAS = 0`),
  limites do primeiro teste.
- `src/teste_ap.ts` + `migrations/0012_teste_ap.sql`: monta, ativa e pausa o teste pago dos 3 criativos aprovados
  (Vídeo 1 "23h47", Vídeo novo "Quanto você pagaria" e a Imagem do catálogo), que ficam em `publico/teste/`.
- Painel: cartão "Teste pago" com os botões Montar, Ativar (só digitando "pode ativar") e Pausar. Só administrador.
- `wrangler.toml`: Worker `gestor-atendimento`, banco `gestor-atendimento`, bucket `gestor-atendimento-criativos`,
  `[assets]` com `run_worker_first = true` (os arquivos não ficam abertos no endereço; só o código lê).

## O teste pago

- 3 campanhas de Tráfego (uma por criativo), cada uma com 1 conjunto e 1 anúncio.
- Cada conjunto: orçamento TOTAL de R$ 54 em 3 dias (a Meta nunca passa do total), só Instagram no celular
  (feed, stories, reels, explorar, perfil), Brasil, mulheres de 20 a 45, interesses de unha (Manicure, Unhas de gel,
  Nail art, Esmalte, Salão de beleza), sem a Meta abrir o público sozinha. Otimiza por clique no link (o site não tem
  pixel).
- Link de cada anúncio com o próprio `utm_source` (`ig-pago-v1`, `ig-pago-v4`, `ig-pago-img`), que o painel do site
  lê. Quem decide no fim são os catálogos montados por origem e as vendas da Kiwify.
- Máximo: R$ 162 mais o imposto da Meta (13,83%), cerca de R$ 184,40.
- Montar cria tudo PAUSADO e pode rodar de novo: continua de onde parou, sem criar nada em dobro. Vídeo que a Meta
  ainda processa termina sozinho pelo cron de 5 em 5 minutos.
- Antes de montar e de ativar, o Worker lê a conta: recusa se ela não estiver em reais ou não estiver ativa, e avisa
  quando o limite de gastos da conta deixa gastar menos que os R$ 162 (o teste pararia antes do fim). Mexer no limite
  é decisão do Vitor.
- Ativar: começa em 2 minutos, termina sozinho em 3 dias e põe o time na guarda: Vigia nível 2 (pausa tudo se o
  gasto do dia passar de R$ 85,05), Gestor nível 2 (executa só a fila, que aqui é a pausa do Vigia), Analista nível 1
  (só sugere), Criador e Públicos desligados.

Pelo terminal (com `ADMIN_TOKEN`): `GET /admin/teste`, `POST /admin/teste/montar`,
`POST /admin/teste/ativar?frase=pode%20ativar`, `POST /admin/teste/pausar`.

## Para ligar (uma vez)

1. Cloudflare: criar o banco D1 `gestor-atendimento` (o id vai em `wrangler.toml`) e o bucket R2
   `gestor-atendimento-criativos`.
2. Criar o Worker pelo painel da Cloudflare a partir deste repositório, ramo `atendimento-pronto`, com o comando de
   publicação `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`. Só com o "pode publicar".
3. Segredos no painel do Worker: `ADMIN_TOKEN` e `LOGIN_SEGREDO` (senhas longas aleatórias), `META_ADS_TOKEN` (token
   de um usuário do sistema do portfólio que tem a conta "Glowhaven Ads", com `ads_read` e `ads_management`, e com
   acesso à conta, à página do Atendimento Pronto e ao Instagram @atendimento.pronto). `OPENROUTER_API_KEY` é
   opcional: sem ela, as partes de IA (Analista, Estrategista, Criador) ficam paradas; o teste funciona igual, porque o
   Vigia e o Gestor são regras.
4. Variáveis: `META_AD_ACCOUNT_ID` e `META_CAMPANHA_PREFIXO` já estão no `wrangler.toml`. Falta `META_PAGE_ID`: a
   página do Facebook do Atendimento Pronto, com o @atendimento.pronto ligado (a conta só tem a página da Glowhaven).
   `META_IG_USER_ID` só se o Worker não achar sozinho o Instagram ligado à página.
5. Usuário do painel: `POST /admin/usuarios {"email": ..., "nome": ..., "papel": "admin"}`.

## Testes

`node --experimental-strip-types --test tests/teste_ap.test.ts tests/conta_dividida.test.ts` (13 testes, com uma
Meta de mentira).

Na suíte inteira, alguns testes antigos do Criador e das regras falham neste ramo porque foram escritos para o texto e
os números de outro negócio (preço R$ 25, "sem cartão", outros limites). Com o `negocio.ts` do `main` eles se
comportam como no `main`. Não é defeito do código.
