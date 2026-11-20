/**
 * TUDO o que é da ExtraIA fica aqui. O resto do código não muda.
 * RASCUNHO para o Vitor aprovar. ExtraIA = canal que ensina e testa ferramentas de IA; o anúncio leva ao quiz,
 * o quiz leva a pessoa a criar algo com uma IA parceira (afiliado). "Venda" = ativação na parceira (via Impact),
 * alimentada por CSV. Não cobramos ninguém, por isso CICLO_DIAS = 0 (não é assinatura nossa).
 */

/** Nome da empresa (aparece no alt da logo e nos nomes dos públicos). */
export const EMPRESA = "ExtraIA";

/** Quem é a empresa, o que vende, quem é o cliente bom e o objetivo dos anúncios. 3 a 6 linhas. */
export const PERFIL_NEGOCIO = `A ExtraIA mostra, todos os dias, como usar ferramentas de inteligência artificial para criar coisas (sites, lojas, textos, imagens) sem saber programar.
O anúncio leva a um quiz; o quiz indica a ferramenta de IA certa e a pessoa cria algo de graça para testar.
O bom público é quem quer começar um negócio ou trabalho online, tem pouco tempo e pouco dinheiro, e vai até o fim criar algo. Curioso que só assiste e não testa, evitar.
Objetivo dos anúncios: trazer gente que entra no quiz e cria de verdade com a ferramenta, não o maior número de cliques.`;

/** O que os anúncios PODEM afirmar. Só o que você consegue provar. Uma linha por afirmação. */
export const AFIRMACOES_PERMITIDAS = `- Dá para criar um site com inteligência artificial sem saber programar.
- A IA cria as fotos, escolhe as cores, escreve os textos e monta a página.
- Dá para testar de graça, sem cartão.
- Leva poucos minutos.
- Todo dia tem uma ferramenta de IA nova explicada.
- Público: quem quer criar algo online e não sabe por onde começar.`;

/** O que NUNCA pode aparecer. Além destas, o código barra promessa de resultado, "oficial", superlativo, urgência falsa e preço diferente. */
export const PROIBIDO = `- Promessa de ganhar dinheiro, de renda extra garantida, de "ficar rico" ou de resultado.
- Garantia de venda, de clientes ou de prazo.
- Números de alunos, de usuários ou de resultados que não estejam provados.
- "Oficial", "aprovado" ou "parceiro" de qualquer plataforma; citar a marca da ferramenta pelo nome.
- "Grátis" sem "teste" junto; "melhor", "número 1", "líder".
- Comparação com concorrente pelo nome. Urgência falsa.
- Inglês, gíria de marketing, emoji além de um por texto, CAIXA ALTA, ponto de exclamação repetido.`;

/** A linha de preço/chamada que fecha a imagem e o texto do anúncio. Exatamente como pode ser afirmada. */
export const PRECO_LINHA = "Crie de graça, sem cartão · em poucos minutos";

/** Preço em reais que o verificador aceita (qualquer "R$ N" diferente é barrado). null = sem checagem de preço. */
export const PRECO_PERMITIDO: number | null = null;

/** Palavras que, acompanhadas de número, viram "número de clientes" e são barradas. */
export const PALAVRAS_CONTAGEM = ["alunos", "usuários", "pessoas", "clientes", "seguidores"];

/** As conversas fictícias do template "tudo misturado" (celular do dono). Troque pelo seu contexto; são inventadas. */
export const TEMPLATE_CONVERSAS: Array<{ iniciais: string; cor: string; nome: string; setor: string; tom: "t1" | "t2" | "t3"; mensagem: string; hora: string; badge: string }> = [
  { iniciais: "SB", cor: "#E89B3C", nome: "Site · Barbearia", setor: "Criação", tom: "t3", mensagem: "Quero um site com tabela de preços", hora: "09:12", badge: "3" },
  { iniciais: "LR", cor: "#4C7FD6", nome: "Loja · Roupas", setor: "Criação", tom: "t2", mensagem: "Dá pra colocar botão de WhatsApp?", hora: "09:05", badge: "1" },
  { iniciais: "PD", cor: "#E0693F", nome: "Página · Doces", setor: "Criação", tom: "t1", mensagem: "Monta uma página pro meu confeito?", hora: "08:47", badge: "2" },
  { iniciais: "ME", cor: "#8A5BC9", nome: "Menu · Restaurante", setor: "Criação", tom: "t3", mensagem: "Preciso de um cardápio online hoje", hora: "08:30", badge: "12" },
  { iniciais: "AP", cor: "#3E9E8A", nome: "Agenda · Salão", setor: "Criação", tom: "t2", mensagem: "Quero agendamento no site…", hora: "ontem", badge: "5" },
  { iniciais: "II", cor: "#8B979D", nome: "IA · todo dia uma nova", setor: "", tom: "t2", mensagem: "Hoje: criar site. Amanhã: outra ferramenta", hora: "seg", badge: "" },
];
/**
 * Vídeo do Criador ("tela do produto"): a conversa acontece numa imitação da tela de uma ferramenta de IA que
 * cria sites. Mantém o estilo da ExtraIA (robô, azul/laranja). Ajustar quando tivermos a tela real da parceira.
 */
export const TELA_PRODUTO = {
  url: "extraia-app.netlify.app/quiz",
  titulo_tela: "Criar com IA",
  menu: [
    { nome: "Início", icone: "grade" }, { nome: "Criar site", icone: "balao", ativo: true },
    { nome: "Minhas páginas", icone: "predio", submenu: true }, { nome: "Imagens", icone: "diamante" },
    { nome: "Textos", icone: "arvore" }, { nome: "Ferramentas de IA", icone: "peca", submenu: true },
    { nome: "Tutoriais", icone: "grafico" }, { nome: "Configurações", icone: "engrenagem" },
  ] as Array<{ nome: string; icone: string; ativo?: boolean; submenu?: boolean; selo?: string } | null>,
  abas: [["Montando", "1"], ["Prontos", "3"], ["Modelos", ""], ["Ajuda", "2"]] as Array<[string, string]>,
  conversas: [["Barbearia Navalha", "Site pronto em 3 min", "12:09", "Normal"], ["Loja da Ana", "Botão de WhatsApp ok", "11:26", "Normal"], ["Doces da Lu", "Página publicada", "11:22", "Normal"], ["Pizzaria Centro", "Cardápio no ar", "11:19", "Normal"], ["Salão Beleza", "Agenda adicionada", "10:59", "Normal"], ["Oficina do Zé", "Tabela de preços ok", "10:59", "Normal"], ["Estúdio Tattoo", "Montando a página…", "10:46", "Fazendo"], ["Padaria Pão Quente", "Fotos geradas", "09:45", "Normal"]] as Array<[string, string, string, string]>,
  origem: "Pedido feito por texto  |  *{setor}*",
  botoes: ["⟳ Refazer", "◷ Publicar", "⊘ Editar", "⊗ Desfazer"],
  campo: "Descreva o site que você quer",
  botao: "Criar de graça · sem cartão",
  unidade_preco: "em minutos",
  cores: { fundo: "#0B2A4A", fundo_fim: "#07182B", destaque: "#3FA7FF", ui: "#2B6CB0", balao_atendente: "#CFE3FF", fundo_chat: "#0E1E33" },
};

/** Cabeçalho do "celular" no template. */
export const TEMPLATE_CABECALHO = { titulo: "Pedidos para a IA", nota: "tudo num lugar só" };

/** País (ISO, minúsculo) e moeda que vão nos eventos para a Meta. */
export const PAIS = "br";
export const MOEDA = "BRL";

/**
 * Como o negócio cobra. A ExtraIA não cobra ninguém (afiliado): CICLO_DIAS = 0 = "ativo" = ativou alguma vez e
 * não cancelou. A "ativação" entra por CSV do Impact.
 */
export const CICLO_DIAS = 0;
export const TOLERANCIA_DIAS = 15;

/** Limites do executor. Mudar aqui é um commit revisado, não um prompt. Valores de PARTIDA, conservadores. */
export const LIMITES = {
  /** Soma do orçamento diário das campanhas ativas nunca passa disto (centavos). R$ 50/dia para começar. */
  TETO_DIARIO_CENTS: 5_000,
  /** Gasto em 7 dias sem nenhum cadastro que faz pausar. R$ 30. */
  PAUSAR_SEM_CADASTRO_CENTS: 3_000,
  /** Custo por cadastro acima de N× o da conta (28 dias) faz reduzir. */
  REDUZIR_FATOR: 2,
  REDUZIR_PCT: 20,
  AUMENTAR_MAX_PCT: 20,
  /** Dias entre mudanças na mesma campanha. */
  FREQUENCIA_DIAS: 7,
  ORCAMENTO_MIN_CENTS: 2_000,
  /** Gasto mínimo em 28 dias para "reduzir" ter base. */
  REDUZIR_MIN_GASTO_CENTS: 10_000,
};
