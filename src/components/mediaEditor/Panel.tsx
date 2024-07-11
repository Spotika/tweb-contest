import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import Icon from '../icon';
import {ButtonIconTsx} from '../buttonIconTsx';
import getProxiedManagers from '../../lib/appManagers/getProxiedManagers';
import Scrollable from '../scrollable';
import {render} from 'solid-js/web';
import ripple from '../ripple';
import {horizontalMenu} from '../horizontalMenu';

type TabInfo = {
  type: 'enchance' |
        'crop' |
        'text' |
        'edit' |
        'stickers';
  icon: Icon;
};

class Panel {
  private container: HTMLDivElement;
  private mediaTabs: TabInfo[] = [ // set type annotation
    {
      type: 'enchance',
      icon: 'enhance'
    },
    {
      type: 'crop',
      icon: 'crop'
    },
    {
      type: 'text',
      icon: 'text'
    },
    {
      type: 'edit',
      icon: 'brush'
    },
    {
      type: 'stickers',
      icon: 'smile'
    }
  ];
  private selectTab;
  private tabs: {[key in TabInfo['type']]: HTMLElement} = {} as any;

  constructor(
    renderElement: HTMLElement,
    close: () => void
  ) {
    this.container = document.createElement('div');
    this.container.classList.add('editor-panel');

    let tabs: HTMLDivElement;
    let tabsContainerRef: HTMLDivElement;
    render(() =>
      <>
        <div class="navbar-tabs">
          <div class="navbar">
            <div class="navbar-left">
              <ButtonIconTsx noRipple={true} onclick={close} icon='close' class="close"/>
              <div class="title">Edit</div>
            </div>
            <div class="actions">
              <ButtonIconTsx icon='undo'/>
              <ButtonIconTsx icon='redo'/>
            </div>
          </div>
          <div ref={tabs}></div>
        </div>
        <div ref={tabsContainerRef}>
        </div>
      </>, this.container);
    const nav = document.createElement('nav');
    nav.classList.add('editor-panel-tabs', 'menu-horizontal-div');
    const tabsMenu = nav;

    for(const mediaTab of this.mediaTabs) {
      const menuTab = document.createElement('div');
      menuTab.classList.add('menu-horizontal-div-item', 'editor-panel-menu-div-item');
      const i = document.createElement('i');
      const icon = Icon(mediaTab.icon, 'menu-horizontal-div-item-span');
      icon.append(i);

      menuTab.append(icon);

      tabsMenu.append(menuTab);
    }

    const tabsContainer = document.createElement('div');
    tabsContainer.classList.add('editor-panel-tabs-container', 'tabs-container');
    for(const mediaTab of this.mediaTabs) {
      const container = document.createElement('div');
      container.classList.add('editor-panel-tab-container', 'editor-panel-container-' + mediaTab.type, 'tabs-tab');

      const content = document.createElement('div');
      content.classList.add('editor-panel-content-container', 'editor-panel-content-' + mediaTab.type);

      container.append(content);

      tabsContainer.append(container);
      this.tabs[mediaTab.type] = content;
    }

    this.selectTab = horizontalMenu(tabsMenu, tabsContainer);
    this.selectTab(0, false);

    createEffect(() => {
      tabs.replaceWith(tabsMenu);
      tabsContainerRef.replaceWith(tabsContainer);
    });
    this.createPages();
    renderElement.replaceWith(this.container);
  }

  private createPages = () => {
    this.tabs.enchance.textContent = '1';
    this.tabs.crop.textContent = '2';
    this.tabs.text.textContent = '3';
    this.tabs.edit.textContent = '4';
    this.tabs.stickers.textContent = '5';
    console.log(this.tabs);
  }
}

export default Panel;
