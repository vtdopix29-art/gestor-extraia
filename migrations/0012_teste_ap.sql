-- Teste pago do Atendimento Pronto (src/teste_ap.ts): uma linha por criativo (v1, v4, img), com os ids que a Meta
-- devolveu em cada etapa. Montar de novo continua de onde parou; nada é criado em dobro.
CREATE TABLE IF NOT EXISTS teste_ap (
  chave TEXT PRIMARY KEY,           -- v1, v4, img
  nome TEXT NOT NULL,
  campanha_id TEXT,
  conjunto_id TEXT,
  midia_id TEXT,                    -- vídeo: video_id; imagem: image_hash
  capa_hash TEXT,                   -- vídeo: miniatura (image_hash)
  criativo_id TEXT,
  anuncio_id TEXT,
  instagram_id TEXT,                -- perfil do Instagram usado no anúncio
  publico_json TEXT,                -- interesses que a Meta achou (id e nome)
  status TEXT NOT NULL DEFAULT 'novo', -- novo, aguardando_video, pausado, ativo, erro
  erro TEXT,
  inicio TEXT,                      -- quando o teste começou (ativar)
  fim TEXT,                         -- quando o conjunto para sozinho
  atualizado_em TEXT NOT NULL
);
