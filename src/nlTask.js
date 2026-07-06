import * as chrono from "chrono-node";

const RECUR_WORDS = {
  daily: "daily",
  "every day": "daily",
  everyday: "daily",
  weekly: "weekly",
  "every week": "weekly",
};

/**
 * Parses free text like "call dentist tomorrow 3pm #work" or
 * "stretch daily #health" into { title, due, recur, project }.
 */
export function parseTaskInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let project = null;
  let withoutTag = trimmed;
  const tagMatch = withoutTag.match(/#([\w-]+)/);
  if (tagMatch) {
    project = tagMatch[1];
    withoutTag = (withoutTag.slice(0, tagMatch.index) + withoutTag.slice(tagMatch.index + tagMatch[0].length))
      .replace(/\s+/g, " ")
      .trim();
  }

  let recur = null;
  let withoutRecur = withoutTag;
  for (const [phrase, kind] of Object.entries(RECUR_WORDS)) {
    const re = new RegExp(`\\b${phrase}\\b`, "i");
    if (re.test(withoutRecur)) {
      recur = kind;
      withoutRecur = withoutRecur.replace(re, "").trim();
      break;
    }
  }

  const results = chrono.parse(withoutRecur, new Date(), { forwardDate: true });
  let due = null;
  let title = withoutRecur;

  if (results.length > 0) {
    const result = results[0];
    due = result.start.date().getTime();
    title = (
      withoutRecur.slice(0, result.index) +
      withoutRecur.slice(result.index + result.text.length)
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!title) title = withoutRecur.trim();
  if (!due && recur) due = Date.now();

  return { title, due, recur, project };
}
