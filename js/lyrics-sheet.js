/* Inline [G]chords stay attached to their lyric syllables as the sheet wraps. */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./guitar-service.js"));
  else root.LyricsSheet = factory(root.GuitarService);
})(globalThis, (service) => {
  const notes = [
    "C",
    "C♯",
    "D",
    "E♭",
    "E",
    "F",
    "F♯",
    "G",
    "A♭",
    "A",
    "B♭",
    "B",
  ];
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function chord(label) {
    // Accept musical qualities, while leaving section headings such as [Chorus] alone.
    if (
      !/^[A-G][#b♯♭]?(?:(?:m|maj|min|dim|aug|sus|add)?\d*(?:[#b+-]\d+)*(?:\([#b\d,]+\))?|°|ø)(?:\/[A-G][#b♯♭]?)?$/.test(
        label,
      )
    )
      return null;
    return service.parseChord(label);
  }
  function transposeChord(label, shift = 0) {
    const parsed = chord(label);
    if (!parsed || !shift) return label;
    const pitch = (value) => notes[(((value + shift) % 12) + 12) % 12];
    return (
      pitch(parsed.root) +
      parsed.quality +
      (Number.isInteger(parsed.bass) ? "/" + pitch(parsed.bass) : "")
    );
  }
  function transpose(source, shift = 0) {
    return source.replace(/\[([^\]\n]+)\]/g, (token, label) =>
      chord(label) ? `[${transposeChord(label, shift)}]` : token,
    );
  }
  function render(source, shift = 0) {
    if (!source.trim())
      return '<p class="lyrics-empty">Add lyrics below, then place chords before the words where they change.</p>';
    return source
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => {
        const parts = [];
        let position = 0,
          current = "";
        const segment = (text) => {
          if (text || current)
            parts.push(
              `<span class="lyrics-segment"><span class="lyrics-chord">${escape(current)}</span><span class="lyrics-word">${escape(text) || "&nbsp;"}</span></span>`,
            );
        };
        for (const match of line.matchAll(/\[([^\]\n]+)\]/g)) {
          if (!chord(match[1])) continue;
          segment(line.slice(position, match.index));
          current = transposeChord(match[1], shift);
          position = match.index + match[0].length;
        }
        segment(line.slice(position));
        return `<div class="lyrics-line">${parts.join("") || "&nbsp;"}</div>`;
      })
      .join("");
  }
  return { render, transpose, transposeChord, chord, escape };
});
