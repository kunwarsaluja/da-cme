import { createTag } from '../block-helpers.js';

const BRAND_IMG = '<img loading="lazy" alt="Adobe" src="/blocks/gnav/adobe-logo.svg">';
const IS_OPEN = 'is-Open';

class Gnav {
  constructor(body, el) {
    this.el = el;
    this.body = body;
    this.env = {};
    this.desktop = window.matchMedia('(min-width: 1200px)');
  }

  init = () => {
    this.state = {};
    this.curtain = createTag('div', { class: 'gnav-curtain' });
    const nav = createTag('nav', { class: 'gnav' });
    const fauxNavbar = createTag('div', { class: 'gnav-faux-navbar' });

    const brand = this.decorateBrand();
    if (brand) {
      const fauxBrand = brand.cloneNode(true);
      fauxNavbar.append(fauxBrand);
      nav.append(brand);
    }

    const mobileToggle = this.decorateToggle(nav);
    const mobileCloseNav = this.decorateCloseNav(nav);
    this.curtain = this.decorateCurtain(nav);
    fauxNavbar.append(mobileToggle);
    nav.append(mobileCloseNav);

    const mainNav = this.decorateMainNav();
    if (mainNav) {
      nav.append(mainNav);
    }

    const wrapper = createTag('div', { class: 'gnav-wrapper' }, nav);
    this.el.append(this.curtain, fauxNavbar);
    this.el.append(this.curtain, wrapper);
  };

  decorateToggle = (nav) => {
    const toggle = createTag('button', { class: 'icon-toggle gnav-toggle', 'aria-label': 'Navigation menu', 'aria-expanded': false });
    const onMediaChange = (e) => {
      if (e.matches) {
        nav.parentElement.classList.remove(IS_OPEN);
        nav.classList.remove(IS_OPEN);
        this.curtain.classList.remove(IS_OPEN);
      }
    };
    toggle.addEventListener('click', async() => {
      this.openNav(nav, onMediaChange);
    });
    return toggle;
  };

  decorateCloseNav = (nav) => {
    const closeNav = createTag('button', { class: 'icon-close gnav-close', 'aria-label': 'Navigation close menu', 'aria-expanded': false });
    closeNav.addEventListener('click', async() => {
      this.closeNav(nav);
    });
    return closeNav;
  };

  decorateCurtain = (nav) => {
    const curtain = createTag('div', { class: 'gnav-curtain' });
    curtain.addEventListener('click', async() => {
      this.closeNav(nav);
    });
    return curtain;
  };

  decorateBrand = () => {
    const brandBlock = this.body.querySelector('[class^="gnav-brand"]');
    if (!brandBlock) return null;
    const brand = brandBlock.querySelector('a');

    const { className } = brandBlock;
    const classNameClipped = className.slice(0, -1);
    const classNames = classNameClipped.split('--');
    brand.className = classNames.join(' ');
    if (brand.classList.contains('with-logo')) {
      brand.insertAdjacentHTML('afterbegin', BRAND_IMG);
    }
    return brand;
  };

  decorateMainNav = () => {
    const mainNav = createTag('ul', { class: 'gnav-mainnav' });
    const primaryLinks = this.body.querySelectorAll('.primary h2 > a');
    if (primaryLinks.length > 0) {
      this.buildMainNav(mainNav, primaryLinks, 'primary');
    }
    const navItem = createTag('li', { class: 'gnav-navitem' });
    navItem.classList.add('divider');
    mainNav.appendChild(navItem);
    const secondaryLinks = this.body.querySelectorAll('.secondary h2 > a');
    if (secondaryLinks.length > 0) {
      this.buildMainNav(mainNav, secondaryLinks, 'secondary');
    }
    return mainNav;
  };

  buildMainNav = (mainNav, navLinks, menuType) => {
    navLinks.forEach((navLink, idx) => {
      const navItem = createTag('li', { class: 'gnav-navitem' });
      const navItemMenuContainer = navLink.closest('div');
      const mainHomeContainer = navItemMenuContainer.nextElementSibling;
      const menu = mainHomeContainer.parentElement.nextElementSibling;
      navItemMenuContainer.querySelector('h2').remove();
      navItem.appendChild(navLink);
      navItem.classList.add(menuType);

      if (menu.childElementCount > 0) {
        const id = `navmenu-${idx}`;
        menu.id = id;
        navItem.classList.add('has-Menu');
        navLink.setAttribute('role', 'button');
        navLink.setAttribute('aria-expanded', false);
        navLink.setAttribute('aria-controls', id);
        mainHomeContainer.classList.add('main-home-link');
        const decoratedMenu = this.decorateMenu(navItem, navLink, menu, mainHomeContainer);
        navItem.appendChild(decoratedMenu);
      }
      mainNav.appendChild(navItem);
    });
  };

  buildSubNav = (menu, subNav, subNavLinks, subMenuType) => {
    const groupMap = new Map();
    subNavLinks.forEach((subNavLink, idx) => {
      const subNavItem = createTag('li', { class: 'gnav-subnavitem' });
      const subNavItemLink = createTag('a', { class: 'gnav-subnavitem-link' });
      const subMenu = subNavLink.parentElement.nextElementSibling.getElementsByTagName('li')[0].getElementsByTagName('ul')[0];
      subNavItemLink.appendChild(subNavLink.cloneNode(true));
      subNavItem.appendChild(subNavItemLink);
      subNavItem.classList.add(subMenuType);

      if (subMenu.childElementCount > 0) {
        const id = `navsubmenu-${idx}`;
        subMenu.id = id;
        subNavItem.classList.add('has-Menu');
        subNavItemLink.setAttribute('role', 'button');
        subNavItemLink.setAttribute('aria-expanded', false);
        subNavItemLink.setAttribute('aria-controls', id);
        const decoratedMenu = this.decorateSubMenu(subNavItem, subNavItemLink, subMenu);
        subNavItem.appendChild(decoratedMenu);

        const parentDiv = subNavLink.closest('div');
        if (parentDiv && parentDiv.querySelector('ul + p em')) {
          const groupName = parentDiv.querySelector('ul + p em').textContent.trim();
          if (!groupMap.has(groupName)) {
            groupMap.set(groupName, createTag('div', { class: `gnav-subnavitem-group-${groupName}` }));
            subNav.appendChild(groupMap.get(groupName));
          }
          groupMap.get(groupName).appendChild(subNavItem);
        } else {
          subNav.appendChild(subNavItem);
        }
      }
    });
  };

  decorateMenu = (navItem, navLink, menu, menuHomeLink) => {
    menu.className = 'gnav-navitem-menu';
    const container = createTag('div', { class: 'gnav-menu-container' });
    const subNav = createTag('ul', { class: 'gnav-subnav' });
    const subMenuLi = menu.querySelectorAll('p em');
    const menuDivs = Array.from(menu.querySelectorAll('div'));
    const divsForMenu = menuDivs.filter((div) => div.querySelector('p'));
    const classColNumber = `sub-menu-col-${divsForMenu.length}`;
    if (subMenuLi.length > 0) {
      this.buildSubNav(menu, subNav, subMenuLi, 'sub-nav');
    }
    container.append(subNav);
    menu.innerHTML = '';
    const desktopMenuContainer = createTag('div', { class: 'item-menu-container' });
    const desktopMenuColumn = createTag('div', { class: 'item-menu-column' });
    desktopMenuContainer.classList.add(classColNumber);
    menu.append(desktopMenuContainer);
    desktopMenuContainer.append(desktopMenuColumn);
    desktopMenuColumn.append(menuHomeLink);
    desktopMenuColumn.append(container);
    // import promo boxes
    const promoBoxes = createTag('div', { class: 'promoBox-subnav' });
    desktopMenuContainer.append(promoBoxes);
    navLink.addEventListener('focus', () => {
      window.addEventListener('keydown', this.toggleOnSpace);
    });
    navLink.addEventListener('blur', () => {
      window.removeEventListener('keydown', this.toggleOnSpace);
    });
    navLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu(navItem);
    });
    return menu;
  };

  decorateSubMenu = (subNavItem, subNavLink, subMenu) => {
    subMenu.className = 'gnav-navitem-submenu';
    subNavLink.addEventListener('focus', () => {
      window.addEventListener('keydown', this.toggleOnSpace);
    });
    subNavLink.addEventListener('blur', () => {
      window.removeEventListener('keydown', this.toggleOnSpace);
    });
    subNavLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu(subNavItem);
    });
    return subMenu;
  };

  openNav = (nav, onMediaChange) => {
    nav.parentElement.classList.add(IS_OPEN);
    nav.classList.add(IS_OPEN);
    this.desktop.addEventListener('change', onMediaChange);
    this.curtain.classList.add(IS_OPEN);
  };

  closeNav = (nav) => {
    if (nav.classList.contains(IS_OPEN)) {
      nav.parentElement.classList.remove(IS_OPEN);
      nav.classList.remove(IS_OPEN);
      this.curtain.classList.remove(IS_OPEN);
      const allElOpen = nav.querySelectorAll('.is-Open');
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < allElOpen.length; i++) {
        this.closeMenu(allElOpen[i]);
      }
    }
  };

  toggleMenu = (el) => {
    if (el && el.classList.contains('is-Open')) {
      this.closeMenu(el);
    } else {
      this.openMenu(el);
    }
  };

  closeMenu = (el) => {
    el.classList.remove(IS_OPEN);
    this.curtain.classList.remove(IS_OPEN);
    document.body.classList.remove('curtain-visible');
    document.removeEventListener('click', this.closeOnDocClick);
    window.removeEventListener('keydown', this.closeOnEscape);
    const menuToggle = el.querySelector('[aria-expanded]');
    menuToggle.setAttribute('aria-expanded', false);
  };

  openMenu = (el) => {
    el.classList.add(IS_OPEN);
    this.curtain.classList.add(IS_OPEN);
    document.body.classList.add('curtain-visible');
    const menuToggle = el.querySelector('[aria-expanded]');
    menuToggle.setAttribute('aria-expanded', true);
    document.addEventListener('click', this.closeOnDocClick);
    window.addEventListener('keydown', this.closeOnEscape);
  };

  toggleOnSpace = (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const parentEl = e.target.closest('.has-Menu');
      this.toggleMenu(parentEl);
    }
  };

  closeOnScroll = () => {
    let scrolled;
    if (!scrolled) {
      if (this.state.openMenu) {
        this.toggleMenu(this.state.openMenu);
      }
      scrolled = true;
      document.removeEventListener('scroll', this.closeOnScroll);
    }
  };

  closeOnDocClick = (e) => {
    const closest = e.target.closest(`.${IS_OPEN}`);
    const isCurtain = e.target === this.curtain;
    if ((this.state.openMenu && !closest) || isCurtain) {
      this.toggleMenu(this.state.openMenu);
    }
  };

  closeOnEscape = (e) => {
    if (e.code === 'Escape') {
      this.toggleMenu(this.state.openMenu);
    }
  };
}

async function fetchGnav(url) {
  const resp = await fetch(`${url}.plain.html`);
  const html = await resp.text();
  return html;
}

export default async function init(blockEl) {
  const url = blockEl.getAttribute('data-gnav-source') || '/drafts/ramiro/nav';
  if (url) {
    const html = await fetchGnav(url);
    if (html) {
      try {
        const parser = new DOMParser();
        const gnavDoc = parser.parseFromString(html, 'text/html');
        const gnav = new Gnav(gnavDoc.body, blockEl);
        gnav.init();
      } catch {
        // eslint-disable-next-line no-console
        console.log('Could not create global navigation.');
      }
    }
  }
}
