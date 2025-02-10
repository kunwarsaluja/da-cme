import { getArticleRelatedMetadata } from '../../scripts/utils.js';

export default function decorate(block) {
  const isLabelsVariant = block.classList.contains('labels');
  const {
    template, readTime, author, tag, date,
  } = getArticleRelatedMetadata();
  if (isLabelsVariant && template === 'article') {
    const labelsWrapper = document.createElement('div');
    labelsWrapper.classList.add('labels-wrapper');
    labelsWrapper.innerHTML = `
      <div class="row">
        <span class="article-time"><span class="icon icon-list"></span>${readTime} READ</span>
        <span class="article-featured-tag">${tag}</span>
        <a class="bookmark" href="#">
          <span id="tooltip-saved" class="icon icon-bookmark-outlined"></span>
          <span class="save-text">Save</span>
        </a>
      </div>
       <div class="row">
        <span class="authors">By ${author}</span>
        <span></span>
        <span class="article-date">${date}</span>
      </div>
    `;
    block.prepend(labelsWrapper);

    const bookmark = document.querySelector('.hero.labels .row .bookmark');
    const tooltip = document.querySelector('#tooltip-saved');
    bookmark.addEventListener('mouseenter', () => {
      tooltip.classList.remove('icon-bookmark-outlined');
      tooltip.classList.add('icon-bookmark-filled');
    });
    bookmark.addEventListener('mouseleave', () => {
      tooltip.classList.remove('icon-bookmark-filled');
      tooltip.classList.add('icon-bookmark-outlined');
    });
    bookmark.addEventListener('click', () => {
      // TODO: Add bookmark functionality
    });
  }
}
