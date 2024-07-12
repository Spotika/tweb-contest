import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {JSXElement, createEffect, createSignal} from 'solid-js'
import Icon from '../icon';
import {ButtonIconTsx} from '../buttonIconTsx';
import getProxiedManagers from '../../lib/appManagers/getProxiedManagers';
import Scrollable from '../scrollable';
import {render} from 'solid-js/web';
import ripple from '../ripple';
import {horizontalMenu} from '../horizontalMenu';
import RangeInput from './editorRangeInput';

type EnhanceProperties = {
  filter: string;
  min: string;
  max: string;
  splitPrecent: number;
  onChange: (newValue: number) => void;
}

export type EditorProperties = {
  [key in Icon]: any;
} | {
  enhance: EnhanceProperties[];
};

class Panel {
  private container: HTMLDivElement;

  private selectTab;
  private tabs: {[key in keyof EditorProperties]: HTMLDivElement} = {} as any;

  constructor(
    renderElement: HTMLElement,
    properties: EditorProperties,
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

    // tabs
    const nav = document.createElement('nav');
    nav.classList.add('editor-panel-tabs', 'menu-horizontal-div');
    const tabsMenu = nav;

    for(const tabName of Object.keys(properties) as Array<keyof typeof properties>) {
      const menuTab = document.createElement('div');
      menuTab.classList.add('menu-horizontal-div-item', 'editor-panel-menu-div-item');
      const i = document.createElement('i');
      const icon = Icon(tabName, 'menu-horizontal-div-item-span');

      icon.append(i);
      menuTab.append(icon);
      tabsMenu.append(menuTab);
    }

    // containers
    const tabsContainer = document.createElement('div');
    tabsContainer.classList.add('editor-panel-tabs-container', 'tabs-container');

    for(const tabName of Object.keys(properties) as Array<keyof typeof properties>) {
      const container = document.createElement('div');
      container.classList.add('editor-panel-tab-container', 'editor-panel-container-' + tabName, 'tabs-tab');

      const content = document.createElement('div');
      content.classList.add('editor-panel-content-container', 'editor-panel-content-' + tabName);

      container.append(content);

      tabsContainer.append(container);
      this.tabs[tabName as keyof EditorProperties] = content;
    }

    this.selectTab = horizontalMenu(tabsMenu, tabsContainer);
    this.selectTab(0, false);

    createEffect(() => {
      tabs.replaceWith(tabsMenu);
      tabsContainerRef.replaceWith(tabsContainer);
    });


    // Tabs creation
    this.createEnhancePanel(properties.enhance);
    renderElement.replaceWith(this.container);
  }

  private createEnhancePanel = (
    enhanceProps: EnhanceProperties[]
  ) => {
    const container = this.tabs.enhance;
    for(const effect of enhanceProps) {
      const effectContainer = document.createElement('div');
      effectContainer.classList.add('enhance-effect-container');

      const infoContainer = document.createElement('div');
      infoContainer.classList.add('effect-container-info');
      effectContainer.append(infoContainer);

      const title = document.createElement('div');
      title.classList.add('effect-container-title');
      title.textContent = effect.filter;
      infoContainer.append(title);

      const value = document.createElement('div');
      value.classList.add('effect-container-value');
      value.textContent = '0';
      infoContainer.append(value);


      const rangeInput = new RangeInput(
        effect.min,
        effect.max,
        '1',
        '0',
        effect.splitPrecent
      );

      rangeInput.input.addEventListener('input', () => {
        effect.onChange(Number(rangeInput.input.value));
        value.textContent = rangeInput.input.value;
        if(rangeInput.input.value != '0') {
          value.classList.add('active');
        } else {
          value.classList.remove('active');
        }
      });

      effectContainer.append(rangeInput.container);

      container.append(effectContainer);
    }
  }
}

export default Panel;
