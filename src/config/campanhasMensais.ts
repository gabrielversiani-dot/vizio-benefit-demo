// Campanhas mensais de saúde - Brasil
export interface CampanhaMensal {
  nome: string;
  descricao: string;
  cores: string[];
  corPrimaria: string;
  sugestoes: string[];
}

export const campanhasMensais: Record<number, CampanhaMensal> = {
  1: {
    nome: "Janeiro Branco",
    descricao: "Mês dedicado à saúde mental e emocional",
    cores: ["#FFFFFF", "#E8E8E8"],
    corPrimaria: "#9CA3AF",
    sugestoes: [
      "Palestra sobre bem-estar emocional",
      "Meditação guiada para colaboradores",
      "Workshop de gestão do estresse",
      "Campanha de conscientização sobre saúde mental"
    ]
  },
  2: {
    nome: "Fevereiro Roxo/Laranja",
    descricao: "Conscientização sobre Alzheimer, Lúpus, Fibromialgia e Leucemia",
    cores: ["#7C3AED", "#F97316"],
    corPrimaria: "#7C3AED",
    sugestoes: [
      "Palestra sobre doenças autoimunes",
      "Ação de doação de medula óssea",
      "Material educativo sobre Alzheimer",
      "Check-up preventivo"
    ]
  },
  3: {
    nome: "Março Azul",
    descricao: "Prevenção do câncer colorretal",
    cores: ["#3B82F6"],
    corPrimaria: "#3B82F6",
    sugestoes: [
      "Campanha de exames preventivos",
      "Palestra sobre alimentação saudável",
      "Orientações sobre sinais de alerta",
      "Parceria com laboratórios para exames"
    ]
  },
  4: {
    nome: "Abril Verde/Azul",
    descricao: "Segurança no trabalho e conscientização sobre autismo",
    cores: ["#22C55E", "#3B82F6"],
    corPrimaria: "#22C55E",
    sugestoes: [
      "SIPAT - Semana de Prevenção",
      "Treinamento de segurança",
      "Palestra sobre inclusão e neurodiversidade",
      "Avaliação ergonômica"
    ]
  },
  5: {
    nome: "Maio Amarelo",
    descricao: "Segurança no trânsito",
    cores: ["#EAB308"],
    corPrimaria: "#EAB308",
    sugestoes: [
      "Campanha de direção defensiva",
      "Blitz educativa",
      "Palestra sobre uso de celular no trânsito",
      "Simulador de direção"
    ]
  },
  6: {
    nome: "Junho Vermelho",
    descricao: "Incentivo à doação de sangue",
    cores: ["#EF4444"],
    corPrimaria: "#EF4444",
    sugestoes: [
      "Campanha de doação de sangue",
      "Parceria com hemocentros",
      "Ação de cadastro de doadores",
      "Material educativo sobre doação"
    ]
  },
  7: {
    nome: "Julho Amarelo/Verde",
    descricao: "Combate às hepatites virais e câncer de cabeça e pescoço",
    cores: ["#EAB308", "#22C55E"],
    corPrimaria: "#EAB308",
    sugestoes: [
      "Campanha de vacinação hepatite B",
      "Exames de triagem",
      "Palestra sobre prevenção",
      "Orientações sobre HPV"
    ]
  },
  8: {
    nome: "Agosto Dourado",
    descricao: "Incentivo ao aleitamento materno",
    cores: ["#F59E0B"],
    corPrimaria: "#F59E0B",
    sugestoes: [
      "Palestra para gestantes",
      "Espaço de amamentação",
      "Material educativo",
      "Apoio às mães lactantes"
    ]
  },
  9: {
    nome: "Setembro Amarelo",
    descricao: "Prevenção ao suicídio e valorização da vida",
    cores: ["#EAB308"],
    corPrimaria: "#EAB308",
    sugestoes: [
      "Campanha de saúde mental",
      "CVV nas empresas",
      "Rodas de conversa",
      "Treinamento de gatekeepers"
    ]
  },
  10: {
    nome: "Outubro Rosa",
    descricao: "Prevenção do câncer de mama",
    cores: ["#EC4899"],
    corPrimaria: "#EC4899",
    sugestoes: [
      "Mutirão de mamografias",
      "Palestra sobre autoexame",
      "Caminhada rosa",
      "Parcerias com clínicas"
    ]
  },
  11: {
    nome: "Novembro Azul",
    descricao: "Prevenção do câncer de próstata e saúde do homem",
    cores: ["#3B82F6"],
    corPrimaria: "#3B82F6",
    sugestoes: [
      "Campanha de exames PSA",
      "Palestra sobre saúde masculina",
      "Ação de check-up",
      "Parceria com urologistas"
    ]
  },
  12: {
    nome: "Dezembro Vermelho/Laranja",
    descricao: "Combate à AIDS e prevenção do câncer de pele",
    cores: ["#EF4444", "#F97316"],
    corPrimaria: "#EF4444",
    sugestoes: [
      "Campanha de prevenção IST/AIDS",
      "Distribuição de protetor solar",
      "Orientações sobre exposição solar",
      "Exames dermatológicos"
    ]
  }
};

export function getCampanhaDoMes(mes: number): CampanhaMensal | null {
  return campanhasMensais[mes] || null;
}
