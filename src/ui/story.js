// Puts the team's story text (content/story.json) on the page.
// Lines that are still TODO-TEAM placeholders get a dashed outline so
// nobody can miss them.

import story from '../../content/story.json';
import { el } from './dom.js';
import { isTodo, fillTemplate, getPath } from '../lib/text.js';

// storyLine('intake.welcome', { codename: 'KESTREL' }) -> a <span> with the text.
export function storyLine(path, values = {}, tag = 'span') {
  const text = getPath(story, path);
  if (typeof text !== 'string') {
    return el(tag, { class: 'todo-team' }, `TODO-TEAM: missing story key "${path}"`);
  }
  // Placeholders are shown exactly as written: their instructions may mention
  // {codename}, and filling that in would garble the instruction.
  if (isTodo(text)) return el(tag, { class: 'todo-team' }, text);
  return el(tag, {}, fillTemplate(text, values));
}
