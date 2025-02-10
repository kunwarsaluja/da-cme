import { getMetadata } from '../../scripts/aem.js';

function getArticleRelatedMetadata() {
    const template = getMetadata('template');
    const readTime = getMetadata('read-time');
    const author = getMetadata('author');
    const tag = getMetadata('tag');
    const date = getMetadata('date');

    return {
        template,
        readTime,
        author,
        tag,
        date,
    };
}

export { getArticleRelatedMetadata };

