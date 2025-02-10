import { getArticleRelatedMetadata } from '../../scripts/utils.js';

export default function decorate(block) {
  const isArticleVariant = block.classList.contains('article');
  const {
    readTime, author, tag, date,
  } = getArticleRelatedMetadata();
  if (isArticleVariant) {
    const h1 = block.querySelector('h1');
    const labelsWrapper = document.createElement('div');
    labelsWrapper.classList.add('labels-wrapper');
    /**
     * Create a wrapper for the labels and the title
     * This is to ensure that the labels and the title are aligned properly
     * and the title is centered
     */
    labelsWrapper.innerHTML = `
      <div class="row">
        <span class="article-time">
          <span class="icon icon-list">
            <img data-icon-name="list" src="/icons/list.svg" alt="" loading="lazy">
          </span>
          ${readTime} READ
        </span>
        <span class="article-featured-tag">${tag}</span>
        <a class="bookmark" href="#">
          <span class="tooltip-saved show icon icon-bookmark-outlined">
            <img data-icon-name="bookmark" src="/icons/bookmark-outlined.svg" alt="" loading="lazy">
          </span>
          <span class="tooltip-saved icon icon-bookmark-filled">
            <img data-icon-name="bookmark" src="/icons/bookmark-filled.svg" alt="" loading="lazy">
          </span>
          <span class="save-text">Save</span>
        </a>
      </div>
      <div class="row article-title">
        ${h1.outerHTML}
      </div>
       <div class="row">
        <span class="authors">By ${author}</span>
        <span></span>
        <span class="article-date">${date}</span>
      </div>
    `;
    block.prepend(labelsWrapper);
    h1.remove();

    const bookmark = document.querySelector('.hero.article .row .bookmark');
    const tooltips = document.querySelectorAll('.tooltip-saved');
    bookmark.addEventListener('mouseenter', () => {
      tooltips.forEach((tooltip) => { tooltip.classList.toggle('show') });
    });
    bookmark.addEventListener('mouseleave', () => {
      tooltips.forEach((tooltip) => { tooltip.classList.toggle('show'); });
    });
    bookmark.addEventListener('click', () => {
      // TODO: Add bookmark functionality
    });
  }
}
