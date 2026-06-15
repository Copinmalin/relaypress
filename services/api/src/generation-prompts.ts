import type { PublicationTarget } from "./content-adapter.js";

export type GenerationStyleProfile = "bconseil_pro" | "relaypress_neutre" | "alpinechain_pedagogique";

export type GenerationPromptInput = {
  platform: PublicationTarget;
  sourceContent: string;
  instruction?: string;
  styleProfile?: GenerationStyleProfile;
  outputFormat?: string;
};

export type GenerationPrompt = {
  instructions: string;
  inputText: string;
};

const BCONSEIL_SIGNATURE = "Decouvrir plus / aller plus loin : consultez copinmalin.top";

type PlatformRules = {
  format: string;
  length: string;
  structure: string[];
};

function platformRules(platform: PublicationTarget): PlatformRules {
  if (platform === "x") {
    return {
      format: "x_bconseil_signal",
      length: "140 caracteres maximum, imperatif.",
      structure: ["Une phrase claire.", "Lien source si disponible.", "Pas de thread."],
    };
  }

  if (platform === "facebook") {
    return {
      format: "facebook_bconseil_signal",
      length: "900 a 1500 caracteres.",
      structure: ["Accroche sobre.", "Ce qui se passe.", "Pourquoi c'est important.", "A surveiller, 1 a 3 puces.", BCONSEIL_SIGNATURE, "Source explicite."],
    };
  }

  if (platform === "instagram") {
    return {
      format: "instagram_future_meta_business_caption",
      length: "Utiliser provisoirement le format Facebook. L'image sera traitee plus tard.",
      structure: ["Texte compatible Meta Business.", "Ne pas decrire une image absente.", "Source explicite."],
    };
  }

  if (platform === "review") {
    return {
      format: "nostr_reference_blog_plan",
      length: "Plus de 1500 caracteres, avec plan detaille.",
      structure: ["Titre de travail.", "Accroche sobre.", "Plan detaille.", "Contexte factuel source.", "Pourquoi c'est important.", "Points a verifier.", BCONSEIL_SIGNATURE, "Source explicite."],
    };
  }

  return {
    format: "linkedin_bconseil_signal",
    length: "1300 a 2000 caracteres.",
    structure: [
      "Accroche sobre : 1 a 2 lignes, signal principal sans dramatisation.",
      "Ce qui se passe : 2 a 4 lignes, resume factuel uniquement depuis la source.",
      "Pourquoi c'est important : 3 a 5 lignes, mise en perspective Bitcoin / souverainete / infrastructure / marche, sans conseil financier.",
      "A surveiller : 1 a 3 puces maximum.",
      BCONSEIL_SIGNATURE,
      "Source explicite.",
    ],
  };
}

function profileTone(styleProfile: GenerationStyleProfile | undefined): string[] {
  if (styleProfile === "relaypress_neutre") {
    return ["Ton neutre, factuel, sobre."];
  }

  if (styleProfile === "alpinechain_pedagogique") {
    return ["Ton pedagogique, accessible aux curieux Bitcoin."];
  }

  return ["Ton professionnel, sobre, pedagogique, accessible grand public.", "Positionnement B-Conseil by Copinmalin."];
}

function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildGenerationPrompt(input: GenerationPromptInput): GenerationPrompt {
  const rules = platformRules(input.platform);
  const styleProfile = input.styleProfile ?? "bconseil_pro";
  const outputFormat = input.outputFormat?.trim() || rules.format;

  const instructions = [
    "# IDENTITE",
    "Tu es RelayPress, assistant de preparation editoriale.",
    "Tu prepares un brouillon de publication B-Conseil by Copinmalin.",
    "Tu ne valides jamais et tu ne publies jamais.",
    "",
    "# MISSION",
    "Transformer un signal source en publication utile pour informer le grand public.",
    "",
    "# REGLES FACTUELLES",
    list([
      "Utiliser uniquement les informations presentes dans les sources fournies.",
      "Ne pas inventer de chiffres.",
      "Ne pas extrapoler.",
      "Ne pas transformer une hypothese en fait.",
      "Ne pas ajouter de contexte externe si aucune source externe n'est fournie.",
      "Ne pas interpreter un titre comme une preuve suffisante d'un fait detaille.",
      "Si la source ne permet pas d'etre precis, formuler prudemment.",
      "Si une affirmation utile n'est pas explicitement sourcee, l'ajouter dans claims_requiring_human_review.",
      "Conserver le lien source fourni quand il existe.",
    ]),
    "",
    "# TON",
    list([...profileTone(styleProfile), "Pas de hype.", "Pas de conseil financier.", "Pas de promesse de rendement.", "Pas d'effet influenceur crypto.", "Pas de dramatisation."]),
    "",
    "# FORMAT PLATEFORME",
    `Plateforme: ${input.platform}`,
    `Format: ${outputFormat}`,
    `Longueur cible: ${rules.length}`,
    list(rules.structure),
    "",
    "# SORTIE",
    "Retourner uniquement un JSON strict, sans Markdown autour, sans texte hors JSON.",
  ].join("\n");

  const inputText = [
    `style_profile: ${styleProfile}`,
    `platform: ${input.platform}`,
    `output_format: ${outputFormat}`,
    `length_rule: ${rules.length}`,
    input.instruction?.trim() ? `editorial_instruction: ${input.instruction.trim()}` : "editorial_instruction: aucune",
    "",
    "source_content:",
    input.sourceContent,
  ].join("\n");

  return { instructions, inputText };
}
