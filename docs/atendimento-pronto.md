# Gestor do Atendimento Pronto (ramo `atendimento-pronto`)

Cópia do Gestor só para o Atendimento Pronto. A ExtraIA continua no ramo `main`, com o Worker `gestor-extraia`.
Mesmo código, mas Worker, banco D1, bucket R2, segredos e conta de anúncios separados. Não misturar.

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
   do usuário do sistema da conta Atendimento Pronto, com `ads_read` e `ads_management`). `OPENROUTER_API_KEY` é
   opcional: sem ela, as partes de IA (Analista, Estrategista, Criador) ficam paradas; o teste funciona igual, porque o
   Vigia e o Gestor são regras.
4. Variáveis: `META_AD_ACCOUNT_ID` (só números) e `META_PAGE_ID`. `META_IG_USER_ID` só se o Worker não achar sozinho
   o Instagram ligado à página.
5. Usuário do painel: `POST /admin/usuarios {"email": ..., "nome": ..., "papel": "admin"}`.

## Testes

`node --experimental-strip-types --test tests/teste_ap.test.ts` (8 testes, com uma Meta de mentira).

Na suíte inteira, alguns testes antigos do Criador e das regras falham neste ramo porque foram escritos para o texto e
os números de outro negócio (preço R$ 25, "sem cartão", outros limites). Com o `negocio.ts` do `main` eles se
comportam como no `main`. Não é defeito do código.
