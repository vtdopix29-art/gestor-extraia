/**
 * TUDO o que é do Atendimento Pronto fica aqui. O resto do código não muda.
 * Esta é a cópia do Gestor só do Atendimento Pronto (ramo atendimento-pronto, Worker gestor-atendimento). A ExtraIA
 * continua no ramo main, com o Worker dela. Não misturar.
 *
 * Atendimento Pronto = site em que a nail designer monta pelo celular um catálogo com os serviços e preços dela.
 * Venda única pela Kiwify (Plano Catálogo R$ 10; Atendimento Pronto · Nail R$ 27,90). Sem assinatura: CICLO_DIAS = 0.
 * Revisado em 23/11/2026 para o primeiro teste pago (3 criativos aprovados pelo Vitor, até R$ 162 no total).
 */

/** Nome da empresa (aparece no alt da logo e nos nomes dos públicos). */
export const EMPRESA = "Atendimento Pronto";

/** Quem é a empresa, o que vende, quem é o cliente bom e o objetivo dos anúncios. 3 a 6 linhas. */
export const PERFIL_NEGOCIO = `O Atendimento Pronto é um site em que a nail designer monta, pelo celular, um catálogo com capa, sobre mim, formatos de unha e os serviços com os preços dela, em 3 estilos para escolher.
Ela testa de graça, sem criar conta (na versão grátis saem 4 páginas com selo). O Plano Catálogo custa R$ 10, pagamento único, e libera todas as páginas sem o selo, em PDF e imagens. Existe também o plano Atendimento Pronto · Nail, de R$ 27,90, pagamento único.
O bom público é a nail designer ou manicure no Brasil que atende pelo Instagram e pelo WhatsApp e passa preço por mensagem. Curiosa que só olha e não monta o catálogo, evitar.
Objetivo dos anúncios: levar ao site quem monta o catálogo grátis e compra o Plano Catálogo, não o maior número de cliques. O site não tem pixel: a Meta não vê os catálogos nem as vendas; esses números vêm do painel do site (por utm_source) e da Kiwify.`;

/** O que os anúncios PODEM afirmar. Só o que você consegue provar. Uma linha por afirmação. */
export const AFIRMACOES_PERMITIDAS = `- A nail designer monta o catálogo de preços pelo celular, em cerca de 3 minutos.
- O catálogo tem capa, sobre mim, formatos e os serviços com os preços dela.
- São 3 estilos para escolher.
- Dá para testar grátis, sem criar conta; na versão grátis saem 4 páginas com selo.
- Plano Catálogo: R$ 10, pagamento único, todas as páginas sem o selo, em PDF e imagens.
- Feito para nail designers e manicures.
- Troque a listinha de preço por um catálogo.`;

/** O que NUNCA pode aparecer. Além destas, o código barra promessa de resultado, "oficial", superlativo, urgência falsa e preço diferente. */
export const PROIBIDO = `- Promessa de mais clientes, de cobrar mais caro, de faturar mais ou de qualquer resultado.
- Números de clientes, de usuárias, de vendas ou depoimentos que não estejam provados.
- Pessoa real ou criada por IA fingindo ser cliente.
- "Oficial", "aprovado" ou "parceiro" de qualquer plataforma; citar marca de terceiros.
- "Grátis" sem "teste" junto; "melhor", "número 1", "líder".
- Comparação com concorrente pelo nome. Urgência falsa ("só hoje", "últimas vagas", "Black Friday" sem desconto de verdade).
- Preço diferente de R$ 10 no anúncio.
- Inglês, gíria de marketing, emoji além de um por texto, CAIXA ALTA, ponto de exclamação repetido.`;

/** A linha de preço/chamada que fecha a imagem e o texto do anúncio. Exatamente como pode ser afirmada. */
export const PRECO_LINHA = "Teste grátis, sem criar conta · Plano Catálogo R$ 10, pagamento único";

/** Preço em reais que o verificador aceita (qualquer "R$ N" diferente é barrado). null = sem checagem de preço. */
export const PRECO_PERMITIDO: number | null = 10;

/** Palavras que, acompanhadas de número, viram "número de clientes" e são barradas. */
export const PALAVRAS_CONTAGEM = ["alunas", "usuárias", "clientes", "pessoas", "seguidores", "vendas", "nail designers"];

/** As conversas fictícias do template "tudo misturado" (celular da nail designer). São inventadas. */
export const TEMPLATE_CONVERSAS: Array<{ iniciais: string; cor: string; nome: string; setor: string; tom: "t1" | "t2" | "t3"; mensagem: string; hora: string; badge: string }> = [
  { iniciais: "JU", cor: "#C9A24B", nome: "Júlia · Alongamento", setor: "Preço", tom: "t3", mensagem: "Oi, quanto é o alongamento?", hora: "23:47", badge: "2" },
  { iniciais: "BI", cor: "#E8B4B8", nome: "Bia · Manutenção", setor: "Preço", tom: "t2", mensagem: "E a manutenção da fibra?", hora: "22:10", badge: "1" },
  { iniciais: "CA", cor: "#A9B8A2", nome: "Carla · Esmaltação", setor: "Agenda", tom: "t1", mensagem: "Tem horário no sábado?", hora: "21:05", badge: "3" },
  { iniciais: "DE", cor: "#8A5BC9", nome: "Dé · Nail art", setor: "Preço", tom: "t3", mensagem: "Quanto fica com decoração?", hora: "20:30", badge: "1" },
  { iniciais: "FE", cor: "#3E9E8A", nome: "Fê · Banho de gel", setor: "Preço", tom: "t2", mensagem: "Me manda os valores?", hora: "ontem", badge: "4" },
  { iniciais: "AP", cor: "#1B1B1B", nome: "Seu catálogo", setor: "", tom: "t2", mensagem: "Capa, serviços e preços num lugar só", hora: "seg", badge: "" },
];
/**
 * Vídeo do Criador ("tela do produto"): imitação da tela do site em que a nail designer monta o catálogo, no visual
 * preto e dourado do Atendimento Pronto. O Criador começa desligado (nível 0) nesta cópia: os anúncios do teste são
 * os 3 criativos que o Vitor aprovou (publico/teste/).
 */
export const TELA_PRODUTO = {
  url: "atendimentopronto.netlify.app",
  titulo_tela: "Monte seu catálogo",
  menu: [
    { nome: "Início", icone: "grade" }, { nome: "Catálogo", icone: "balao", ativo: true },
    { nome: "Serviços e preços", icone: "predio" }, { nome: "Estilos", icone: "diamante" },
    { nome: "Sobre mim", icone: "arvore" }, { nome: "Formatos", icone: "peca" },
    { nome: "Baixar PDF", icone: "grafico" }, { nome: "Ajuda", icone: "engrenagem" },
  ] as Array<{ nome: string; icone: string; ativo?: boolean; submenu?: boolean; selo?: string } | null>,
  abas: [["Montando", "1"], ["Prontos", "3"], ["Estilos", "3"], ["Ajuda", ""]] as Array<[string, string]>,
  conversas: [["Júlia Nails", "Catálogo pronto em 3 min", "12:09", "Normal"], ["Bia Unhas", "Preços adicionados", "11:26", "Normal"], ["Studio Carla", "Estilo Rosé escolhido", "11:22", "Normal"], ["Dé Nail Art", "PDF baixado", "11:19", "Normal"], ["Fê Esmalteria", "Sobre mim pronto", "10:59", "Normal"], ["Lu Gel", "Montando o catálogo…", "10:46", "Fazendo"]] as Array<[string, string, string, string]>,
  origem: "Montado pelo celular  |  *{setor}*",
  botoes: ["⟳ Refazer", "◷ Baixar", "⊘ Editar", "⊗ Desfazer"],
  campo: "Digite o serviço e o preço",
  botao: "Teste grátis · sem criar conta",
  unidade_preco: "pagamento único",
  cores: { fundo: "#141414", fundo_fim: "#0A0A0A", destaque: "#C9A24B", ui: "#8C6D2E", balao_atendente: "#F1E6DF", fundo_chat: "#1E1A16" },
};

/** Cabeçalho do "celular" no template. */
export const TEMPLATE_CABECALHO = { titulo: "Clientes pedindo preço", nota: "responda com o catálogo" };

/** País (ISO, minúsculo) e moeda que vão nos eventos para a Meta. */
export const PAIS = "br";
export const MOEDA = "BRL";

/** Como o negócio cobra: venda única pela Kiwify, sem assinatura. CICLO_DIAS = 0 = comprou alguma vez. */
export const CICLO_DIAS = 0;
export const TOLERANCIA_DIAS = 15;

/** Limites do executor. Mudar aqui é um commit revisado, não um prompt. Valores do primeiro teste (23/11/2026). */
export const LIMITES = {
  /**
   * Teto do dia (centavos): R$ 81. A média do teste é R$ 54 por dia (3 criativos de R$ 18), mas cada conjunto tem
   * orçamento TOTAL de R$ 54 em 3 dias e a Meta distribui: gasta um pouco mais num dia e menos no outro, sem nunca
   * passar do total (R$ 162). O teto fica 1,5× acima da média para o Vigia não cortar o teste por essa variação
   * normal: ele pausa tudo se o gasto do dia passar de 105% disto (R$ 85,05), o que só aconteceria se algo saísse do
   * controle (alguém mexendo no orçamento, por exemplo). O Gestor nunca deixa a soma dos orçamentos diários ativos
   * passar daqui.
   */
  TETO_DIARIO_CENTS: 8_100,
  /**
   * Gasto em 7 dias sem nenhum cadastro que faz pausar: R$ 54, o orçamento inteiro de um criativo no teste. A Meta não
   * vê os catálogos montados (o site não tem pixel), então a regra só sugere a pausa quando o criativo já gastou tudo.
   */
  PAUSAR_SEM_CADASTRO_CENTS: 5_400,
  /** Custo por cadastro acima de N× o da conta (28 dias) faz reduzir. */
  REDUZIR_FATOR: 2,
  REDUZIR_PCT: 20,
  AUMENTAR_MAX_PCT: 20,
  /** Dias entre mudanças na mesma campanha. */
  FREQUENCIA_DIAS: 7,
  ORCAMENTO_MIN_CENTS: 1_000,
  /** Gasto mínimo em 28 dias para "reduzir" ter base. */
  REDUZIR_MIN_GASTO_CENTS: 10_000,
};
