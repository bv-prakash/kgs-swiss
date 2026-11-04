export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-stats-item';
    const body = document.createElement('div');
    body.className = 'cards-stats-body';
    [...row.children].forEach((cell) => body.append(...cell.childNodes));
    if (!body.textContent.trim()) return;

    // stat value: first paragraph that is (mostly) a <strong>, else first element
    const blocks = [...body.children];
    const value = blocks.find((el) => {
      const strong = el.querySelector('strong, b');
      return strong && strong.textContent.trim() === el.textContent.trim();
    }) || blocks[0];
    if (value) value.classList.add('cards-stats-value');
    blocks.filter((el) => el !== value).forEach((el) => el.classList.add('cards-stats-label'));

    li.append(body);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
