import {createEffect, createSignal, JSX, onMount} from 'solid-js'
import Icon from '../icon';
import {ButtonIconTsx} from '../buttonIconTsx';
import {render} from 'solid-js/web';
import {horizontalMenu} from '../horizontalMenu';
import RangeInput from './editorRangeInput';
import Editor from './editor';
import ripple from '../ripple';
import InputField, {InputState} from '../inputField';
import EditorColorPicker from './colorPicker';
import {EmoticonsDropdown} from '../emoticonsDropdown';
import StickersTab from '../emoticonsDropdown/tabs/stickers';
import rootScope from '../../lib/rootScope';

export const EnhanceFilters = [
  'Enhance',
  'Brightness',
  'Contrast',
  'Saturation',
  'Warmth',
  'Fade',
  'Highlights',
  'Shadows',
  'Vingette',
  'Grain',
  'Sharpen'
] as const;

export type EnhanceProperties = {
  filter: typeof EnhanceFilters[number];
  min: string;
  max: string;
  splitPrecent: number;
}

export type CropProperties = {
  ratioX: number,
  ratioY: number
}

export type EditProperties = {
  icon: Icon;
  name: string;
}

export type EnhanceEvent = {
  type: 'enhance';
  filter: EnhanceProperties['filter'];
  value: number;
}

export type CropEvent = {
  type: 'crop',
  data: string
}

export type EditorProperties = {
  enhance: EnhanceProperties[];
  crop: string[];
  brush: null;
  text: null;
  smile: null;
};

export type EditEvent = EnhanceEvent | CropEvent;

class Panel {
  private container: HTMLDivElement;

  private properties: EditorProperties = {
    enhance: [{
      filter: 'Enhance',
      min: '0',
      max: '100',
      splitPrecent: 0
    }, {
      filter: 'Brightness',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Contrast',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Saturation',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Warmth',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Fade',
      min: '0',
      max: '100',
      splitPrecent: 0
    }, {
      filter: 'Highlights',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Shadows',
      min: '-100',
      max: '100',
      splitPrecent: 50
    }, {
      filter: 'Vingette',
      min: '0',
      max: '100',
      splitPrecent: 0
    }, {
      filter: 'Grain',
      min: '0',
      max: '100',
      splitPrecent: 0
    }, {
      filter: 'Sharpen',
      min: '0',
      max: '100',
      splitPrecent: 0
    }],
    crop: [
      '3_2', '4_3', '5_4', '7_5', '16_9'
    ],
    text: null,
    brush: null,
    smile: null
  };


  private selectTab;
  private tabs: {[key in keyof EditorProperties]: HTMLDivElement} = {} as any;

  private eventChain: EditEvent[] = [];
  private currentState: number = -1; // points to last event element
  private editorRef: Editor;

  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;

  private emoticonsDropdown: EmoticonsDropdown;

  constructor(
    renderElement: HTMLElement,
    editor: Editor,
    close: () => void
  ) {
    this.editorRef = editor;
    this.editorRef.setSaveEvent(this.saveEvent.bind(this));

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
              <ButtonIconTsx ref={this.undoButton} icon='undo' onclick={() => {
                this.undo();
              }}/>
              <ButtonIconTsx ref={this.redoButton} icon='redo'onclick={() => {
                this.redo();
              }}/>
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

    for(const tabName of Object.keys(this.properties) as Array<keyof typeof this.properties>) {
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

    for(const tabName of Object.keys(this.properties) as Array<keyof typeof this.properties>) {
      const container = document.createElement('div');
      container.classList.add('editor-panel-tab-container', 'editor-panel-container-' + tabName, 'tabs-tab');

      const content = document.createElement('div');
      content.classList.add('editor-panel-content-container', 'editor-panel-content-' + tabName);

      container.append(content);

      tabsContainer.append(container);
      this.tabs[tabName as keyof EditorProperties] = content;
    }

    this.selectTab = horizontalMenu(tabsMenu, tabsContainer, (id: number) => {
      if(id == 1) {
        this.editorRef.enableCropMode();
      } else {
        this.editorRef.disableCropMode();
      }

      if(id == 3) {
        this.editorRef.enableBrushMode();
      } else {
        this.editorRef.disableBrushMode();
      }

      if(id == 2) {
        this.editorRef.enableTextMode();
      } else {
        this.editorRef.disableTextMode();
      }

      if(id == 4) {
        this.emoticonsDropdown?.toggle(true);
        this.editorRef.enableStickersMode();
      } else {
        this.emoticonsDropdown?.toggle(false);
        this.editorRef.disableStickersMode();
      }
    });
    this.selectTab(0, false); // TODO: change to 0 if not debug

    createEffect(() => {
      tabs.replaceWith(tabsMenu);
      tabsContainerRef.replaceWith(tabsContainer);
      this.updateActions();
    });


    // Tabs creation
    this.createEnhanceTab();
    this.createCropTab();
    this.createBrushTab();
    this.createTextTab();
    this.createSmileTab();
    renderElement.replaceWith(this.container);
  }

  private saveEvent(e: EditEvent) {
    // remove forward events
    while(this.eventChain.length - 1 > this.currentState) {
      this.eventChain.pop();
    }

    ++this.currentState;
    this.eventChain.push(e);
    this.updateActions();
  }

  // Tab creation
  private createEnhanceTab() {
    const container = this.tabs.enhance;
    for(const effect of this.properties.enhance) {
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
      rangeInput.input.id = 'range-' + effect.filter;

      let oldValue = '0';

      rangeInput.input.addEventListener('input', () => {
        value.textContent = rangeInput.input.value;
        if(rangeInput.input.value != '0') {
          value.classList.add('active');
        } else {
          value.classList.remove('active');
        }
        this.editorRef.processEvent({
          type: 'enhance',
          filter: effect.filter,
          value: Number(rangeInput.input.value)
        });
      });

      rangeInput.input.addEventListener('mouseup', () => {
        if(rangeInput.input.value == oldValue) return;
        this.saveEvent({
          type: 'enhance',
          filter: effect.filter,
          value: Number(rangeInput.input.value)
        });
        oldValue = rangeInput.input.value;
      });

      effectContainer.append(rangeInput.container);

      container.append(effectContainer);
    }
  }

  private createCropTab() {
    const container = this.tabs.crop;

    const setButtonContext = (buttons: HTMLButtonElement[], onChange: (button: HTMLButtonElement) => void) => {
      let activeButton = buttons[0];
      activeButton.classList.add('active');

      for(const button of buttons) {
        button.addEventListener('click', () => {
          if(activeButton == button) return;
          activeButton.classList.remove('active');
          activeButton = button;
          activeButton.classList.add('active');
          onChange(button);
        });
      }
    };

    const variantButton = (icon_name: Icon | null, text: string, filter: string) => {
      const button = document.createElement('button');
      button.id = 'variant-button-' + filter;
      button.classList.add('variant-button');
      if(icon_name != null) {
        const icon = Icon(icon_name);
        button.append(icon);
      }

      const textContainer = document.createElement('div');
      textContainer.textContent = text;
      button.append(textContainer);

      ripple(button);

      return button;
    };

    // title
    const title = document.createElement('div');
    title.classList.add('crop-title');
    title.textContent = 'Aspect ratio';
    container.append(title);

    // common buttons
    const freeBtn = variantButton('free', 'Free', 'free');
    const originalBtn = variantButton('original', 'Original', 'original');
    const squareBtn = variantButton('square', 'Square', '1_1');
    container.append(freeBtn, originalBtn, squareBtn);

    const contextButtons: HTMLButtonElement[] = [freeBtn, originalBtn, squareBtn];

    for(const ratio_variant of this.properties.crop) {
      const variantBtn = variantButton('r' + ratio_variant.replace('_', 'x') as Icon, ratio_variant.replace('_', ':'), ratio_variant);
      const variantBtnMirrored = variantButton('r' + ratio_variant.split('_').reverse().join('x') as Icon, ratio_variant.replace('_', ':').split(':').reverse().join(':'), ratio_variant.split('_').reverse().join('_'));
      const variantContainer = document.createElement('div');
      variantContainer.classList.add('variant-container');
      variantContainer.append(variantBtn, variantBtnMirrored);
      contextButtons.push(variantBtn, variantBtnMirrored);
      container.append(variantContainer);
    }

    setButtonContext(contextButtons, (button) => {
      const type = button.id.split('-')[2];
      this.editorRef.processEvent({
        type: 'crop',
        data: type
      });
    });

    // on free editor callback
    this.editorRef.linkCropFreeCallback(() => {
      const freeButton = document.getElementById('variant-button-free');
      const event = new InputEvent('click');
      freeButton.dispatchEvent(event);
    });
  }

  private createBrushTab() {
    const container = this.tabs.brush;


    const colorPicker = new EditorColorPicker((color) => {
      this.container.style.setProperty('--selected-color', color);
      this.editorRef.setBrushColor(color);
    }, 'brush');
    container.append(colorPicker.container);
    this.container.style.setProperty('--selected-color', 'white');
    this.editorRef.setBrushColor('white');


    // * size selection
    const sizeSelectWrapper = document.createElement('div');
    {
      sizeSelectWrapper.classList.add('size-select-wrapper');

      const textWrapper = document.createElement('div');
      textWrapper.classList.add('size-select-text-wrapper');


      const titleContainer = document.createElement('div');
      titleContainer.classList.add('title-container');
      titleContainer.textContent = 'Size';

      const valueContainer = document.createElement('div');
      valueContainer.classList.add('value-container');
      valueContainer.textContent = '15';

      textWrapper.append(titleContainer, valueContainer);

      const slider = new RangeInput(
        '5',
        '25',
        '1',
        '15',
        0
      );

      slider.input.addEventListener('input', () => {
        valueContainer.textContent = slider.input.value;
        this.editorRef.changeBrushSize(parseInt(slider.input.value))
      });

      sizeSelectWrapper.append(textWrapper, slider.container);
    }

    container.append(sizeSelectWrapper);

    // * tool panel
    const toolPanelWrapper = document.createElement('div');
    toolPanelWrapper.classList.add('tool-panel-wrapper');
    {
      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = 'Tool';

      const tools = document.createElement('div');
      tools.classList.add('tools');

      const setButtonContext = (buttons: HTMLButtonElement[], onChange: (button: HTMLButtonElement) => void) => {
        let activeButton = buttons[0];
        activeButton.classList.add('active');

        for(const button of buttons) {
          button.addEventListener('click', () => {
            if(activeButton == button) return;
            activeButton.classList.remove('active');
            activeButton = button;
            activeButton.classList.add('active');
            onChange(button);
          });
        }
      };

      const variantButton = (element: HTMLElement, text: string, filter: string) => {
        const button = document.createElement('button');
        button.id = 'variant-button-' + filter;
        button.classList.add('variant-button');

        button.append(element);

        const textContainer = document.createElement('div');
        textContainer.textContent = text;
        button.append(textContainer);

        ripple(button);

        return button;
      };

      const toolIcon = {
        pen: `<svg width="120" height="20" viewBox="0 0 120 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_5235_488)">
        <g filter="url(#filter0_iiii_5235_488)">
        <path d="M0 1H80L110.2 8.44653C112.048 8.90213 112.971 9.12994 113.185 9.49307C113.369 9.80597 113.369 10.194 113.185 10.5069C112.971 10.8701 112.048 11.0979 110.2 11.5535L80 19H0V1Z" fill="#3E3F3F"/>
        </g>
        <path d="M112.564 10.9709L103.474 13.2132C103.21 13.2782 102.944 13.121 102.883 12.8566C102.736 12.2146 102.5 11.0296 102.5 10C102.5 8.9705 102.736 7.7855 102.883 7.14345C102.944 6.87906 103.21 6.72188 103.474 6.78685L112.564 9.02913C113.578 9.27925 113.578 10.7208 112.564 10.9709Z" fill="var(--selected-color)"/>
        <path d="M76 1.5C76 1.22386 76.2239 1 76.5 1H79.5C79.7761 1 80 1.22386 80 1.5V18.5C80 18.7761 79.7761 19 79.5 19H76.5C76.2239 19 76 18.7761 76 18.5V1.5Z" fill="var(--selected-color)"/>
        </g>
        <defs>
        <filter id="filter0_iiii_5235_488" x="0" y="-4" width="116.323" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_488"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_488" result="effect2_innerShadow_5235_488"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_488" result="effect3_innerShadow_5235_488"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_488" result="effect4_innerShadow_5235_488"/>
        </filter>
        <clipPath id="clip0_5235_488">
        <rect width="20" height="120" fill="var(--selected-color)" transform="matrix(0 1 -1 0 120 0)"/>
        </clipPath>
        </defs>
        </svg>`,
        arrow: `<svg width="84" height="20" viewBox="0 0 84 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_5235_499)">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M66.9393 2.93934C67.5251 2.35355 68.4749 2.35355 69.0607 2.93934L75.0607 8.93934C75.6464 9.52513 75.6464 10.4749 75.0607 11.0607L69.0607 17.0607C68.4749 17.6464 67.5251 17.6464 66.9393 17.0607C66.3536 16.4749 66.3536 15.5251 66.9393 14.9393L70.3787 11.5H58C57.1716 11.5 56.5 10.8284 56.5 10C56.5 9.17157 57.1716 8.5 58 8.5H70.3787L66.9393 5.06066C66.3536 4.47487 66.3536 3.52513 66.9393 2.93934Z" fill="url(#paint0_linear_5235_499)"/>
        <g filter="url(#filter0_iiii_5235_499)">
        <path d="M-36 1H56C58.2091 1 60 2.79086 60 5V15C60 17.2091 58.2091 19 56 19H-36V1Z" fill="#3E3F3F"/>
        </g>
        <path d="M56 1C58.2091 1 60 2.79086 60 5V15C60 17.2091 58.2091 19 56 19V1Z" fill="var(--selected-color)"/>
        </g>
        <defs>
        <filter id="filter0_iiii_5235_499" x="-36" y="-4" width="99" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_499"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_499" result="effect2_innerShadow_5235_499"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_499" result="effect3_innerShadow_5235_499"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_499" result="effect4_innerShadow_5235_499"/>
        </filter>
        <linearGradient id="paint0_linear_5235_499" x1="74" y1="10" x2="58" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0.755" stop-color="var(--selected-color)"/>
        <stop offset="1" stop-color="var(--selected-color)" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="clip0_5235_499">
        <rect width="20" height="120" fill="var(--selected-color)" transform="matrix(0 1 -1 0 84 0)"/>
        </clipPath>
        </defs>
        </svg>`,
        brush: `<svg width="84" height="20" viewBox="0 0 84 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_5235_509)">
        <g filter="url(#filter0_iiii_5235_509)">
        <path d="M-36 1H46.3579C47.4414 1 48.5135 1.22006 49.5093 1.64684L55 4H65C65.5523 4 66 4.44772 66 5V15C66 15.5523 65.5523 16 65 16H55L49.5093 18.3532C48.5135 18.7799 47.4414 19 46.3579 19H-36V1Z" fill="#3E3F3F"/>
        </g>
        <path d="M40 1.5C40 1.22386 40.2239 1 40.5 1H43.5C43.7761 1 44 1.22386 44 1.5V18.5C44 18.7761 43.7761 19 43.5 19H40.5C40.2239 19 40 18.7761 40 18.5V1.5Z" fill="var(--selected-color)"/>
        <path d="M66 5H70.4338C70.7851 5 71.1106 5.1843 71.2913 5.4855L76.0913 13.4855C76.4912 14.152 76.0111 15 75.2338 15H66V5Z" fill="var(--selected-color)"/>
        </g>
        <defs>
        <filter id="filter0_iiii_5235_509" x="-36" y="-4" width="105" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_509"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_509" result="effect2_innerShadow_5235_509"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_509" result="effect3_innerShadow_5235_509"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_509" result="effect4_innerShadow_5235_509"/>
        </filter>
        <clipPath id="clip0_5235_509">
        <rect width="20" height="120" fill="var(--selected-color)" transform="matrix(0 1 -1 0 84 0)"/>
        </clipPath>
        </defs>
        </svg>`,
        neon: `<svg width="84" height="20" viewBox="0 0 84 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_5235_518)">
        <g filter="url(#filter0_f_5235_518)">
        <path d="M66 5H71.1459C72.2822 5 73.3233 5.64872 73.6009 6.75061C73.8131 7.59297 74 8.70303 74 10C74 11.297 73.8131 12.407 73.6009 13.2494C73.3233 14.3513 72.2822 15 71.1459 15H66V5Z" fill="var(--selected-color)"/>
        </g>
        <g filter="url(#filter1_f_5235_518)">
        <path d="M66 5H71.1459C72.2822 5 73.3233 5.64872 73.6009 6.75061C73.8131 7.59297 74 8.70303 74 10C74 11.297 73.8131 12.407 73.6009 13.2494C73.3233 14.3513 72.2822 15 71.1459 15H66V5Z" fill="var(--selected-color)"/>
        </g>
        <g filter="url(#filter2_f_5235_518)">
        <path d="M66 5H71.1459C72.2822 5 73.3233 5.64872 73.6009 6.75061C73.8131 7.59297 74 8.70303 74 10C74 11.297 73.8131 12.407 73.6009 13.2494C73.3233 14.3513 72.2822 15 71.1459 15H66V5Z" fill="var(--selected-color)"/>
        </g>
        <g filter="url(#filter3_iiii_5235_518)">
        <path d="M-36 1H46.3579C47.4414 1 48.5135 1.22006 49.5093 1.64684L55 4H65C65.5523 4 66 4.44772 66 5V15C66 15.5523 65.5523 16 65 16H55L49.5093 18.3532C48.5135 18.7799 47.4414 19 46.3579 19H-36V1Z" fill="#3E3F3F"/>
        </g>
        <path d="M40 1.5C40 1.22386 40.2239 1 40.5 1H43.5C43.7761 1 44 1.22386 44 1.5V18.5C44 18.7761 43.7761 19 43.5 19H40.5C40.2239 19 40 18.7761 40 18.5V1.5Z" fill="var(--selected-color)"/>
        <path d="M66 5H71.1459C72.2822 5 73.3233 5.64872 73.6009 6.75061C73.8131 7.59297 74 8.70303 74 10C74 11.297 73.8131 12.407 73.6009 13.2494C73.3233 14.3513 72.2822 15 71.1459 15H66V5Z" fill="var(--selected-color)"/>
        </g>
        <defs>
        <filter id="filter0_f_5235_518" x="60" y="-1" width="20" height="22" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3" result="effect1_foregroundBlur_5235_518"/>
        </filter>
        <filter id="filter1_f_5235_518" x="60" y="-1" width="20" height="22" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3" result="effect1_foregroundBlur_5235_518"/>
        </filter>
        <filter id="filter2_f_5235_518" x="60" y="-1" width="20" height="22" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3" result="effect1_foregroundBlur_5235_518"/>
        </filter>
        <filter id="filter3_iiii_5235_518" x="-36" y="-4" width="105" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_518"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_518" result="effect2_innerShadow_5235_518"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_518" result="effect3_innerShadow_5235_518"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_518" result="effect4_innerShadow_5235_518"/>
        </filter>
        <clipPath id="clip0_5235_518">
        <rect width="20" height="120" fill="var(--selected-color)" transform="matrix(0 1 -1 0 84 0)"/>
        </clipPath>
        </defs>
        </svg>`,
        blur: `<svg width="84" height="24" viewBox="0 0 84 24" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <g filter="url(#filter0_f_5235_530)">
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="var(--selected-color)"/>
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="url(#pattern0_5235_530)"/>
        </g>
        <g filter="url(#filter1_f_5235_530)">
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="var(--selected-color)"/>
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="url(#pattern1_5235_530)"/>
        </g>
        <g filter="url(#filter2_f_5235_530)">
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="var(--selected-color)"/>
        <path d="M74 12C74 14.7614 71.7614 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 57.5 16 57.5 12C57.5 8 61.1783 10.9696 63.416 10C65.6874 9.0158 66.9497 7 69 7C71.7614 7 74 9.23858 74 12Z" fill="url(#pattern2_5235_530)"/>
        </g>
        <g filter="url(#filter3_iiii_5235_530)">
        <path d="M-38 3H39.441C39.7836 3 40.0968 3.19357 40.25 3.5C40.4032 3.80643 40.7164 4 41.059 4H56.941C57.2836 4 57.5968 3.80643 57.75 3.5C57.9032 3.19357 58.2164 3 58.559 3H62C63.1046 3 64 3.89543 64 5V19C64 20.1046 63.1046 21 62 21H58.559C58.2164 21 57.9032 20.8064 57.75 20.5C57.5968 20.1936 57.2836 20 56.941 20H41.059C40.7164 20 40.4032 20.1936 40.25 20.5C40.0968 20.8064 39.7836 21 39.441 21H-38V3Z" fill="#3E3F3F"/>
        </g>
        <g filter="url(#filter4_f_5235_530)">
        <path d="M74 12C74 14.7614 71.7615 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 63.416 16 63.416 12C63.416 8 61.1783 10.9696 63.4161 10C65.6875 9.0158 66.9497 7 69 7C71.7615 7 74 9.23858 74 12Z" fill="var(--selected-color)"/>
        <path d="M74 12C74 14.7614 71.7615 17 69 17C66.9497 17 65.7429 14.9774 63.5 14C61.2358 13.0133 63.416 16 63.416 12C63.416 8 61.1783 10.9696 63.4161 10C65.6875 9.0158 66.9497 7 69 7C71.7615 7 74 9.23858 74 12Z" fill="url(#pattern3_5235_530)"/>
        </g>
        <mask id="mask0_5235_530" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-36" y="3" width="100" height="18">
        <path d="M-36 3H39.441C39.7836 3 40.0968 3.19357 40.25 3.5C40.4032 3.80643 40.7164 4 41.059 4H56.941C57.2836 4 57.5968 3.80643 57.75 3.5C57.9032 3.19357 58.2164 3 58.559 3H62C63.1046 3 64 3.89543 64 5V19C64 20.1046 63.1046 21 62 21H58.559C58.2164 21 57.9032 20.8064 57.75 20.5C57.5968 20.1936 57.2836 20 56.941 20H41.059C40.7164 20 40.4032 20.1936 40.25 20.5C40.0968 20.8064 39.7836 21 39.441 21H-36V3Z" fill="#3E3F3F"/>
        </mask>
        <g mask="url(#mask0_5235_530)">
        <path d="M41 21V3H40V21H41Z" fill="black" fill-opacity="0.33"/>
        <path d="M58 21V3H57V21H58Z" fill="black" fill-opacity="0.33"/>
        </g>
        <defs>
        <filter id="filter0_f_5235_530" x="50.5" y="0" width="30.5" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3.5" result="effect1_foregroundBlur_5235_530"/>
        </filter>
        <pattern id="pattern0_5235_530" patternContentUnits="objectBoundingBox" width="1" height="1">
        <use xlink:href="#image0_5235_530" transform="matrix(0.000488281 0 0 0.000805664 0 -0.325)"/>
        </pattern>
        <filter id="filter1_f_5235_530" x="50.5" y="0" width="30.5" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3.5" result="effect1_foregroundBlur_5235_530"/>
        </filter>
        <pattern id="pattern1_5235_530" patternContentUnits="objectBoundingBox" width="1" height="1">
        <use xlink:href="#image0_5235_530" transform="matrix(0.000488281 0 0 0.000805664 0 -0.325)"/>
        </pattern>
        <filter id="filter2_f_5235_530" x="50.5" y="0" width="30.5" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3.5" result="effect1_foregroundBlur_5235_530"/>
        </filter>
        <pattern id="pattern2_5235_530" patternContentUnits="objectBoundingBox" width="1" height="1">
        <use xlink:href="#image0_5235_530" transform="matrix(0.000488281 0 0 0.000805664 0 -0.325)"/>
        </pattern>
        <filter id="filter3_iiii_5235_530" x="-38" y="-2" width="105" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_530"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_530" result="effect2_innerShadow_5235_530"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_530" result="effect3_innerShadow_5235_530"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_530" result="effect4_innerShadow_5235_530"/>
        </filter>
        <filter id="filter4_f_5235_530" x="55.4215" y="0" width="25.5786" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="3.5" result="effect1_foregroundBlur_5235_530"/>
        </filter>
        <pattern id="pattern3_5235_530" patternContentUnits="objectBoundingBox" width="1" height="1">
        <use xlink:href="#image0_5235_530" transform="matrix(0.000488281 0 0 0.000565358 0 -0.0789267)"/>
        </pattern>
        <image id="image0_5235_530" width="2048" height="2048" href="public/assets/img/color-picker.png"/>
        </defs>
        </svg>`,
        eraser: `<svg width="84" height="20" viewBox="0 0 84 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_5235_546)">
        <g filter="url(#filter0_i_5235_546)">
        <path d="M59 1H72C74.2091 1 76 2.79086 76 5V15C76 17.2091 74.2091 19 72 19H59V1Z" fill="#D9D9D9"/>
        <path d="M59 1H72C74.2091 1 76 2.79086 76 5V15C76 17.2091 74.2091 19 72 19H59V1Z" fill="#F09B99"/>
        </g>
        <g filter="url(#filter1_iiii_5235_546)">
        <path d="M-36 1H41.6464C41.8728 1 42.0899 0.910072 42.25 0.75C42.4101 0.589928 42.6272 0.5 42.8536 0.5H60C61.1046 0.5 62 1.39543 62 2.5V17.5C62 18.6046 61.1046 19.5 60 19.5H42.8536C42.6272 19.5 42.4101 19.4101 42.25 19.25C42.0899 19.0899 41.8728 19 41.6464 19H-36V1Z" fill="#3E3F3F"/>
        </g>
        <path d="M43 19.5V0.5L42 0.5V19.5H43Z" fill="black" fill-opacity="0.33"/>
        </g>
        <defs>
        <filter id="filter0_i_5235_546" x="59" y="-1" width="19" height="20" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="2" dy="-2"/>
        <feGaussianBlur stdDeviation="2"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.33 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_546"/>
        </filter>
        <filter id="filter1_iiii_5235_546" x="-36" y="-4.5" width="101" height="29" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_5235_546"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="3" dy="-5"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.14902 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_5235_546" result="effect2_innerShadow_5235_546"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="-1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect2_innerShadow_5235_546" result="effect3_innerShadow_5235_546"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="1" dy="1"/>
        <feGaussianBlur stdDeviation="0.5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.242217 0 0 0 0 0.247242 0 0 0 0 0.247101 0 0 0 1 0"/>
        <feBlend mode="normal" in2="effect3_innerShadow_5235_546" result="effect4_innerShadow_5235_546"/>
        </filter>
        <clipPath id="clip0_5235_546">
        <rect width="20" height="120" fill="var(--selected-color)" transform="matrix(0 1 -1 0 84 0)"/>
        </clipPath>
        </defs>
        </svg>`
      }

      const buttons: HTMLButtonElement[] = [];

      for(const key of Object.keys(toolIcon) as Array<keyof typeof toolIcon>) {
        const toolContainer = document.createElement('div');
        toolContainer.classList.add('tool-container');

        toolContainer.innerHTML = toolIcon[key];

        buttons.push(variantButton(toolContainer, key[0].toUpperCase() + key.slice(1), key));
      }

      setButtonContext(buttons, (button: HTMLButtonElement) => {
        this.editorRef.changeBrushTool(button.id.split('-')[2] as any);
      });
      tools.append(...buttons);
      toolPanelWrapper.append(title, tools);
    }
    container.append(toolPanelWrapper);
  }

  private createTextTab() {
    const container = this.tabs.text;

    const colorPicker = new EditorColorPicker((color) => {
      this.editorRef.properties.text.dragableManager?.changeStyle({
        color: color
      })
    }, 'text');
    // this.editorRef.properties.text.dragableManager.changeStyle({
    //   color: 'white'
    // });

    const createButtonContext = (buttons: HTMLButtonElement[], onChange: (key: string) => void, firstActive: number) => {
      let activeButton = buttons[firstActive];
      activeButton.classList.add('active');

      for(const button of buttons) {
        button.addEventListener('click', () => {
          if(button == activeButton) return;

          activeButton.classList.remove('active');
          activeButton = button;
          activeButton.classList.add('active');

          onChange(activeButton.getAttribute('key'));
        });
      }
    }

    const textVariantsContainer = document.createElement('div');
    textVariantsContainer.classList.add('text-variants-container');

    {
      const createVariantButton = (icon: Icon, key: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.classList.add('variant-button');
        ripple(button);
        button.append(Icon(icon));
        button.setAttribute('key', key);

        return button;
      }

      const alignContainer = document.createElement('div');
      alignContainer.classList.add('align-container');
      const alignButtons = [
        createVariantButton('alignleft', 'left'),
        createVariantButton('aligncenter', 'center'),
        createVariantButton('alignright', 'right'),
      ]
      alignContainer.append(...alignButtons);
      createButtonContext(alignButtons, (key: string) => {
        this.editorRef.properties.text.dragableManager.changeStyle({
          align: key as any,
        });
      }, 1);


      const strokeContainer = document.createElement('div');
      strokeContainer.classList.add('stroke-container');

      const strokeButtons = [
        createVariantButton('textregular', 'regular'),
        createVariantButton('textoutline','outline'),
        createVariantButton('textinverse', 'inverse'),
      ]
      strokeContainer.append(...strokeButtons);
      createButtonContext(strokeButtons, (key: string) => {
        this.editorRef.properties.text.dragableManager.changeStyle({
          type: key as any
        });
      }, 2);

      textVariantsContainer.append(alignContainer, strokeContainer);
    }

    const sizeSelectWrapper = document.createElement('div');
    {
      sizeSelectWrapper.classList.add('size-select-wrapper');

      const textWrapper = document.createElement('div');
      textWrapper.classList.add('size-select-text-wrapper');


      const titleContainer = document.createElement('div');
      titleContainer.classList.add('title-container');
      titleContainer.textContent = 'Size';

      const valueContainer = document.createElement('div');
      valueContainer.classList.add('value-container');
      valueContainer.textContent = '24';

      textWrapper.append(titleContainer, valueContainer);

      const slider = new RangeInput(
        '12',
        '36',
        '1',
        '24',
        0
      );

      slider.input.addEventListener('input', () => {
        valueContainer.textContent = slider.input.value;
        this.editorRef.properties.text.dragableManager.changeStyle({
          size: parseInt(slider.input.value)
        })
      });

      sizeSelectWrapper.append(textWrapper, slider.container);
    }

    const fontSelectWrapper = document.createElement('div');
    fontSelectWrapper.classList.add('font-select-wrapper');
    {
      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = 'Font';

      // const fonts = ['Roboto', 'AmericanTypewriter', 'Avenir Next', 'Courier New', 'Noteworthy', 'Georgia', 'Papyrus', 'Shell Roundhand'];
      const fonts = [{
        label: 'Roboto',
        family: 'Roboto',
      }, {
        label: 'Typewriter',
        family: 'American Typewriter',
      }, {
        label: 'Avenir Next',
        family: 'Avenir Next',
      }, {
        label: 'Courier New',
        family: 'Courier New',
      }, {
        label: 'Noteworthy',
        family: 'Noteworthy',
      }, {
        label: 'Georgia',
        family: 'Georgia',
      }, {
        label: 'Papyrus',
        family: 'Papyrus',
      }, {
        label: 'Shell Roundhand',
        family: 'Shell Roundhand',
      }];

      const createFontButton = (font: typeof fonts[0]): HTMLButtonElement => {
        const button = document.createElement('button');
        button.classList.add('font-button');
        button.setAttribute('key', font.family);

        if(font.family == 'Papyrus') {
          button.style.fontWeight = '400';
        }

        ripple(button);
        button.textContent = font.label;
        button.style.fontFamily = `${font.family}, serif`;
        return button;
      }

      const fontButtons = fonts.map(createFontButton);
      createButtonContext(fontButtons, (font: string) => {
        this.editorRef.properties.text.dragableManager.changeStyle({
          fontFamily: font,
        });
      }, 0);
      fontSelectWrapper.append(title,...fontButtons);
    }

    container.append(colorPicker.container);
    container.append(textVariantsContainer);
    container.append(sizeSelectWrapper);
    container.append(fontSelectWrapper);
  }

  private createSmileTab() {
    const container = this.tabs.smile;
    this.emoticonsDropdown = new EmoticonsDropdown({
      customParentElement: container,
      tabsToRender: [new StickersTab(rootScope.managers)],
      stayAlwaysOpen: true,
      fullHeight: true,
      onMount: (el: any) => {
        el.style.height = `100%`;
        el.style.maxHeight = `100%`;
        el.style.setProperty('--height', `100%`);
      },
      onMediaClicked: (e: any) => {
        const el = e.target as HTMLDivElement;
        const stickerId = el.dataset['docId'];
        this.editorRef.addSticker(stickerId);
      }
    });
    this.emoticonsDropdown.toggle(false);
  }

  private updateActions() {
    this.undoButton.disabled = this.currentState == -1;
    this.redoButton.disabled = this.currentState == this.eventChain.length - 1;
  }

  private undo(this: this) {
    if(this.eventChain[this.currentState] == undefined) return;

    const cancelableEvent: EditEvent = this.eventChain[this.currentState];
    switch(cancelableEvent.type) {
      case 'enhance':
        let replaceEvent: EnhanceEvent = {
          type: 'enhance',
          filter: cancelableEvent.filter,
          value: 0
        }

        for(let i = this.currentState - 1; i >= 0; --i) {
          const suggestedEvent: EditEvent = this.eventChain[i];

          if(suggestedEvent.type == 'enhance' &&
             suggestedEvent.filter == cancelableEvent.filter
          ) {
            replaceEvent = suggestedEvent;
            break;
          }
        }
        const inputEvent = new InputEvent('input');
        const inputToChange: HTMLInputElement = document.getElementById('range-' + replaceEvent.filter) as HTMLInputElement;
        inputToChange.value = replaceEvent.value.toString();
        inputToChange.dispatchEvent(inputEvent);
        break;
    }
    --this.currentState;
    this.updateActions();
  }

  private redo() {
    if(this.eventChain[this.currentState + 1] == undefined) return;
    const event = this.eventChain[this.currentState + 1];

    switch(event.type) {
      case 'enhance':
        const inputEvent = new InputEvent('input');
        const inputToChange: HTMLInputElement = document.getElementById('range-' + event.filter) as HTMLInputElement;
        inputToChange.value = event.value.toString();
        inputToChange.dispatchEvent(inputEvent);
        break;
    }

    this.editorRef.processEvent(event);
    ++this.currentState;
    this.updateActions();
  }
}

export default Panel;
