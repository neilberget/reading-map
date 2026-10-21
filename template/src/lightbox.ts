import type { Picture } from './content';

/** Pictures shown anywhere on the page, by file, so a click on any of them opens it large. */
const shown = new Map<string, Picture>();

const attr = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A picture as a button that opens the viewer. */
export function pictureButton(pic: Picture, cls: string): string {
  shown.set(pic.file, pic);
  const size = pic.width && pic.height ? ` width="${pic.width}" height="${pic.height}"` : '';
  return (
    `<button type="button" class="pic-open ${cls}" data-pic="${attr(pic.file)}" aria-label="Enlarge: ${attr(pic.caption)}">` +
    `<img src="${attr(pic.src)}" alt="${attr(pic.caption)}" loading="lazy"${size}></button>`
  );
}

/** "Credit · Licence", with the licence linking to the source page. */
export function creditLine(pic: Picture): string {
  const license = pic.page
    ? `<a href="${attr(pic.page)}" target="_blank" rel="noopener">${attr(pic.license)}</a>`
    : attr(pic.license);
  return `${attr(pic.credit)} · ${license}`;
}

let dialog: HTMLDialogElement | null = null;

function open(pic: Picture) {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('a')) dialog!.close();
    });
    document.body.append(dialog);
  }
  dialog.innerHTML =
    `<figure><img src="${attr(pic.src)}" alt="${attr(pic.caption)}">` +
    `<figcaption><span class="lightbox-caption">${attr(pic.caption)}</span>` +
    `<span class="lightbox-credit">${creditLine(pic)}</span></figcaption></figure>` +
    `<button type="button" class="lightbox-close" aria-label="Close">×</button>`;
  dialog.showModal();
}

document.addEventListener('click', (e) => {
  const button = (e.target as Element).closest<HTMLElement>('.pic-open');
  const pic = button && shown.get(button.dataset.pic ?? '');
  if (!pic) return;
  e.preventDefault();
  open(pic);
});
