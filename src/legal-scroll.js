export function activeLegalSection(sections, readingTop, atBottom = false) {
  if (!sections.length) return null;
  if (atBottom) return sections.at(-1).id;
  let active = sections[0].id;
  for (const section of sections) {
    if (section.top > readingTop + 1) break;
    active = section.id;
  }
  return active;
}
