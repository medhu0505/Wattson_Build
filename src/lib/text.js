// Small helpers for story text (content/story.json).

export const TODO_MARK = 'TODO-TEAM';

// True if this text is still a placeholder the team hasn't written yet.
export function isTodo(text) {
  return typeof text === 'string' && text.startsWith(TODO_MARK);
}

// Swap {names} in curly brackets for real values:
//   fillTemplate('Welcome, {codename}.', { codename: 'KESTREL' })  ->  'Welcome, KESTREL.'
// A {name} with no value is left as it is, so mistakes are easy to spot.
export function fillTemplate(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}

// Look up a value in a nested object by a dotted path:
//   getPath(story, 'intake.oath')  ->  story.intake.oath
export function getPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}
