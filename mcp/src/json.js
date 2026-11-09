/** Preserve API 64-bit identifiers as strings before JSON.parse can round them. */
export function parseApiJson(text) {
  const safe = String(text).replace(
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (token) => {
      if (token.startsWith('"') || !/^-?\d+$/.test(token)) return token;
      return Number.isSafeInteger(Number(token)) ? token : JSON.stringify(token);
    },
  );
  return JSON.parse(safe);
}
