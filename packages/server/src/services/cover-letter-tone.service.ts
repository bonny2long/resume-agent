export type CoverLetterTone =
  | "professional"
  | "enthusiastic"
  | "friendly"
  | "formal";

export type CoverLetterToneAssessment = {
  passed: boolean;
  issues: string[];
  metrics: {
    contractions: number;
    exclamations: number;
    enthusiasmWords: number;
    friendlyWords: number;
    avgSentenceLength: number;
  };
};

const CONTRACTION_PATTERN =
  /\b(?:i['’]m|i['’]ve|i['’]ll|i['’]d|you['’]re|you['’]ve|you['’]ll|you['’]d|we['’]re|we['’]ve|we['’]ll|we['’]d|they['’]re|they['’]ve|they['’]ll|they['’]d|it['’]s|that['’]s|there['’]s|here['’]s|let['’]s|can['’]t|won['’]t|don['’]t|doesn['’]t|didn['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|shouldn['’]t|couldn['’]t|wouldn['’]t|haven['’]t|hasn['’]t|hadn['’]t)\b/gi;
const ENTHUSIASM_PATTERN =
  /\b(excited|eager|enthusiastic|energized|thrilled|passionate)\b/gi;
const FRIENDLY_PATTERN = /\b(glad|appreciate|welcome|enjoy|happy)\b/gi;

const FORMAL_CONTRACTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bI['’]m\b/gi, "I am"],
  [/\bI['’]ve\b/gi, "I have"],
  [/\bI['’]ll\b/gi, "I will"],
  [/\bI['’]d\b/gi, "I would"],
  [/\byou['’]re\b/gi, "you are"],
  [/\bwe['’]re\b/gi, "we are"],
  [/\bthey['’]re\b/gi, "they are"],
  [/\bit['’]s\b/gi, "it is"],
  [/\bthat['’]s\b/gi, "that is"],
  [/\bthere['’]s\b/gi, "there is"],
  [/\bhere['’]s\b/gi, "here is"],
  [/\blet['’]s\b/gi, "let us"],
  [/\bcan['’]t\b/gi, "cannot"],
  [/\bwon['’]t\b/gi, "will not"],
  [/\bdon['’]t\b/gi, "do not"],
  [/\bdoesn['’]t\b/gi, "does not"],
  [/\bdidn['’]t\b/gi, "did not"],
  [/\bisn['’]t\b/gi, "is not"],
  [/\baren['’]t\b/gi, "are not"],
  [/\bwasn['’]t\b/gi, "was not"],
  [/\bweren['’]t\b/gi, "were not"],
  [/\bshouldn['’]t\b/gi, "should not"],
  [/\bcouldn['’]t\b/gi, "could not"],
  [/\bwouldn['’]t\b/gi, "would not"],
  [/\bhaven['’]t\b/gi, "have not"],
  [/\bhasn['’]t\b/gi, "has not"],
  [/\bhadn['’]t\b/gi, "had not"],
];

function countPatternMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function splitSentences(text: string): string[] {
  return (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function expandCommonContractions(text: string): string {
  let expanded = text;
  for (const [pattern, replacement] of FORMAL_CONTRACTION_REPLACEMENTS) {
    expanded = expanded.replace(pattern, replacement);
  }
  return expanded;
}

export function normalizeCoverLetterTone(
  value: string | undefined,
): CoverLetterTone {
  const tone = `${value || ""}`.trim().toLowerCase();
  if (tone === "enthusiastic" || tone === "friendly" || tone === "formal") {
    return tone;
  }
  return "professional";
}

export function getCoverLetterToneGuide(tone: CoverLetterTone): string {
  switch (tone) {
    case "formal":
      return [
        "Use a formal business voice.",
        "No contractions (use 'I am', 'do not').",
        "Use precise, conservative wording.",
        "Avoid casual phrasing and slang.",
      ].join(" ");
    case "friendly":
      return [
        "Use a warm, approachable professional voice.",
        "Contractions are allowed.",
        "Use clear, conversational wording while staying respectful.",
        "Avoid stiff corporate language.",
      ].join(" ");
    case "enthusiastic":
      return [
        "Use energetic, optimistic professional voice.",
        "Use active verbs and momentum-focused phrasing.",
        "Show excitement about mission and role without sounding exaggerated.",
        "Use at most one exclamation mark in the entire letter.",
      ].join(" ");
    case "professional":
    default:
      return [
        "Use neutral, polished, business-professional voice.",
        "Keep language concise and direct.",
        "Avoid overly casual or overly formal extremes.",
      ].join(" ");
  }
}

export function applyCoverLetterTonePostProcessing(
  text: string,
  tone: CoverLetterTone,
): string {
  let output = `${text || ""}`.replace(/\r\n/g, "\n").trim();
  if (!output) return "";

  switch (tone) {
    case "formal":
      output = expandCommonContractions(output);
      output = output.replace(/!/g, ".");
      break;
    case "friendly":
      if (countPatternMatches(output, CONTRACTION_PATTERN) === 0) {
        output = output
          .replace(/\bI am\b/g, "I'm")
          .replace(/\bI would\b/g, "I'd")
          .replace(/\bI will\b/g, "I'll");
      }
      output = output.replace(
        /\bPlease do not hesitate to contact me\b/gi,
        "I'd be glad to discuss this further",
      );
      output = output.replace(/!{2,}/g, "!");
      break;
    case "enthusiastic": {
      let usedExclamation = false;
      output = output.replace(/!/g, () => {
        if (!usedExclamation) {
          usedExclamation = true;
          return "!";
        }
        return ".";
      });

      if (!usedExclamation) {
        const withSignal = output.replace(
          /(I(?:['’]m| am)\s+(?:excited|eager|enthusiastic)[^.!?\n]*)([.!?])/i,
          "$1!",
        );
        if (withSignal !== output) {
          output = withSignal;
        } else {
          output = output.replace(
            /([A-Z][^.!?\n]{20,140})([.!?])/,
            "$1!",
          );
        }
      }
      break;
    }
    case "professional":
    default:
      output = output.replace(/!+/g, ".");
      output = output
        .replace(/\bI['’]?m excited\b/gi, "I am interested")
        .replace(/\bthrilled\b/gi, "interested");
      break;
  }

  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Preserve paragraph/newline structure; only collapse extra inline spaces.
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function assessCoverLetterTone(
  text: string,
  tone: CoverLetterTone,
): CoverLetterToneAssessment {
  const body = `${text || ""}`.trim();
  const contractions = countPatternMatches(body, CONTRACTION_PATTERN);
  const exclamations = countPatternMatches(body, /!/g);
  const enthusiasmWords = countPatternMatches(body, ENTHUSIASM_PATTERN);
  const friendlyWords = countPatternMatches(body, FRIENDLY_PATTERN);
  const sentenceLengths = splitSentences(body).map(
    (sentence) => sentence.split(/\s+/).filter(Boolean).length,
  );
  const avgSentenceLength =
    sentenceLengths.length > 0
      ? Number(
          (
            sentenceLengths.reduce((sum, length) => sum + length, 0) /
            sentenceLengths.length
          ).toFixed(1),
        )
      : 0;

  const issues: string[] = [];

  if (tone === "formal") {
    if (contractions > 0) issues.push("formal_has_contractions");
    if (exclamations > 0) issues.push("formal_has_exclamation");
  } else if (tone === "friendly") {
    if (contractions === 0) issues.push("friendly_missing_contraction");
    if (exclamations > 1) issues.push("friendly_too_many_exclamations");
  } else if (tone === "enthusiastic") {
    if (enthusiasmWords === 0 && exclamations === 0) {
      issues.push("enthusiastic_missing_energy_signal");
    }
    if (exclamations > 1) issues.push("enthusiastic_too_many_exclamations");
  } else {
    if (exclamations > 0) issues.push("professional_has_exclamation");
    if (enthusiasmWords > 1) issues.push("professional_too_energetic");
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      contractions,
      exclamations,
      enthusiasmWords,
      friendlyWords,
      avgSentenceLength,
    },
  };
}
