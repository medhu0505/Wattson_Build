// A tiny helper for building page elements in JavaScript.
//
//   el('p', { class: 'note' }, 'Hello')
//
// makes <p class="note">Hello</p>. Text is always added as plain text, never
// as HTML, so whatever an agent types (like their codename) can't break the page.

export function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      // onClick -> 'click' event
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(name, '');
    } else {
      element.setAttribute(name, value);
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }

  return element;
}

// Read a message out to screen-reader users (the #announcer box is "live").
export function announce(message) {
  const box = document.getElementById('announcer');
  if (!box) return;
  box.textContent = '';
  // A short wait makes screen readers notice the same message twice in a row.
  setTimeout(() => { box.textContent = message; }, 50);
}
