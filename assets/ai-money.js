
(() => {
'use strict';
const page = document.querySelector('.ai-money-content');
if (!page) return;
const categories = ['Stablecoin', 'Bitcoin', 'Fiat', 'Remaining'];
const roleOrder = ['Medium of exchange', 'Settlement', 'Store of value', 'Unit of account'];
const roles = [...page.querySelectorAll('[data-role]')].map(row => ({name:row.dataset.role,counts:row.dataset.counts.split(',').map(Number)})).sort((a,b)=>roleOrder.indexOf(a.name)-roleOrder.indexOf(b.name));
const share = (count) => (count / 315 * 100).toFixed(2);
const rankedRoles = category => [...roles].sort((a,b)=>b.counts[category]-a.counts[category]);
const segmentOrder = category => [category,...categories.map((_,i)=>i).filter(i=>i!==category)];
const models = [...page.querySelectorAll('#model-rows tr')].map(row => [row.querySelector('th').textContent,...[...row.querySelectorAll('td')].map(cell => [cell.firstChild.textContent,cell.querySelector('small').textContent])]);
const chart = document.querySelector('#chart');
const controls = [...document.querySelectorAll('[data-category]')];
const rows = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const neutral = ['#e7e9e4', '#9ba39d', '#505c54'];
let active = 0;

for (const row of chart.querySelectorAll('[data-role]')) {
 rows.set(row.dataset.role, {row,track:row.querySelector('.track'),breakdown:row.querySelector('.breakdown'),value:row.querySelector('.share')});
}

function render(category, animate = false) {
  const oldPositions = new Map();
  for (const [name, { row }] of rows) {
    if (animate) oldPositions.set(name, row.getBoundingClientRect().top);
    row.getAnimations().forEach(animation => animation.cancel());
  }
  for (const role of rankedRoles(category)) {
    const { row, track, breakdown, value } = rows.get(role.name);
    track.replaceChildren();
    breakdown.replaceChildren();
    let neutralIndex = 0;
    for (const index of segmentOrder(category)) {
      const count = role.counts[index];
      const percent = share(count);
      const segment = document.createElement('span');
      segment.className = 'segment' + (index === category ? ' selected' : '');
      segment.style.width = `${count / 315 * 100}%`;
      if (index !== category) {
        segment.style.background = neutral[neutralIndex++];
        if (neutralIndex === 3) segment.style.color = '#ffffff';
      }
      segment.title = `${categories[index]}: ${count} of 315 (${percent}%)`;
      track.append(segment);
      if (index !== category) {
        const label = document.createElement('span');
        label.textContent = `${categories[index]} ${percent}%`;
        breakdown.append(label);
      }
    }
    const valueLabel = document.createElement('span');
    valueLabel.className = 'sr-only';
    valueLabel.textContent = `${categories[category]} `;
    value.replaceChildren(valueLabel, `${share(role.counts[category])}%`);
    chart.append(row);
  }
  if (animate && !reducedMotion.matches) {
    for (const [name, { row }] of rows) {
      const distance = oldPositions.get(name) - row.getBoundingClientRect().top;
      if (distance) row.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.2,.75,.25,1)' });
    }
  }
  controls.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.category) === category)));
  chart.setAttribute('aria-label', `Monetary roles ranked by ${categories[category]} share, highest first`);
  document.querySelector('#ranking').textContent = `Ranked by ${categories[category]} share · highest first`;
  active = category;
}
reducedMotion.addEventListener('change', event => {
  if (event.matches) for (const { row } of rows.values()) row.getAnimations().forEach(animation => animation.cancel());
});
controls.forEach(button => button.addEventListener('click', () => {
  const category = Number(button.dataset.category);
  if (category !== active) render(category, true);
}));
render(0);

const tableRegion = document.querySelector('.table-scroll');
tableRegion.setAttribute('aria-label', 'Model comparison table');
const picker = document.createElement('div');
picker.className = 'model-picker';
const pickerLabel = document.createElement('label');
pickerLabel.htmlFor = 'model-role';
pickerLabel.textContent = 'Compare models for';
const roleSelect = document.createElement('select');
roleSelect.id = 'model-role';
roleSelect.className = 'model-choice';
roleSelect.setAttribute('aria-controls', 'mobile-models');
roles.forEach((role, index) => {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = role.name;
  roleSelect.append(option);
});
const modelStatus = document.createElement('p');
modelStatus.className = 'model-status';
modelStatus.setAttribute('aria-live', 'polite');
modelStatus.setAttribute('aria-atomic', 'true');
const mobileModels = document.createElement('dl');
mobileModels.className = 'mobile-models';
mobileModels.id = 'mobile-models';
function renderModelRole() {
  const index = Number(roleSelect.value);
  mobileModels.replaceChildren();
  for (const [name, ...cells] of models) {
    const row = document.createElement('div');
    row.className = 'mobile-model-row';
    const term = document.createElement('dt');
    term.textContent = name;
    const value = document.createElement('dd');
    value.textContent = cells[index][0];
    const percent = document.createElement('span');
    percent.textContent = cells[index][1];
    value.append(percent);
    row.append(term, value);
    mobileModels.append(row);
  }
  modelStatus.textContent = `${roles[index].name} · 63 classifications per model`;
}
roleSelect.addEventListener('change', renderModelRole);
picker.append(pickerLabel, roleSelect, modelStatus);
tableRegion.after(picker, mobileModels);
renderModelRole();

// Keep in-page links clear of the desktop sticky header when text is enlarged.
const header = document.querySelector('.site-header');
if (header && typeof ResizeObserver !== 'undefined') {
const headerObserver = new ResizeObserver(entries => {
  document.documentElement.style.setProperty('--am-header-offset', `${entries[0].target.getBoundingClientRect().height + 16}px`);
});
headerObserver.observe(header);
}
page.dataset.enhanced = 'true';
document.querySelector('#comparison-controls').hidden = false;
})();
