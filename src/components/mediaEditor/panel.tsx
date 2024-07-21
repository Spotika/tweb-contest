import {createEffect} from 'solid-js'
import Icon from '../icon';
import {ButtonIconTsx} from '../buttonIconTsx';
import {render} from 'solid-js/web';
import {horizontalMenu} from '../horizontalMenu';
import RangeInput from './editorRangeInput';
import Editor from './editor';
import ripple from '../ripple';

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
  edit: null;
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
    edit: null
  };


  private selectTab;
  private tabs: {[key in keyof EditorProperties]: HTMLDivElement} = {} as any;

  private eventChain: EditEvent[] = [];
  private currentState: number = -1; // points to last event element
  private editorRef: Editor;

  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;


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
    this.createEditTab();
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
    title.textContent = 'Aspect ratio'; // TODO: do trunslate
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

  private createEditTab() {
    const container = this.tabs.edit;

    const currentColor = 'white';

    const colorPickContainer = document.createElement('div');
    colorPickContainer.classList.add('color-pick-container');

    const colorButtonsContainer = document.createElement('div');
    colorButtonsContainer.classList.add('color-buttons-container');


    // color pick button
    const colorPickerButton = document.createElement('button');
    colorPickerButton.classList.add('color-picker-button');
    const colorPickerButtonCore = document.createElement('div');
    colorPickerButtonCore.classList.add('color-picker-button-core');
    colorPickerButtonCore.style.backgroundImage = `url('assets/img/color-picker.png')`;
    colorPickerButton.append(colorPickerButtonCore);


    // color pick slider
    const colorPickSliderContainer = document.createElement('div');
    colorPickSliderContainer.classList.add('color-pick-slider-container', 'inactive');

    const colorPickSlider = document.createElement('input');
    colorPickSlider.classList.add('color-pick-slider');
    colorPickSlider.type = 'range';
    colorPickSlider.min = '0';
    colorPickSlider.value = '50';
    colorPickSlider.max = '100';1

    // color slider functional
    {
      const gradientColors = [
        {pos: 0, color: '#FF0000'},
        {pos: 14.29, color: '#FF8A00'},
        {pos: 28.57, color: '#FFE600'},
        {pos: 42.86, color: '#14FF00'},
        {pos: 57.14, color: '#00A3FF'},
        {pos: 71.43, color: '#0500FF'},
        {pos: 85.71, color: '#AD00FF'},
        {pos: 100, color: '#FF0000'}
      ];
      colorPickSlider.addEventListener('input', () => {
        const color = getColorFromValue(colorPickSlider.value);
        changeCurrentColor(color);
      });
      function getColorFromValue(value: string) {
        const color = getInterpolatedColor(parseFloat(value));
        return color;
      }

      function getInterpolatedColor(value: number) {
        for(let i = 0; i < gradientColors.length - 1; i++) {
          const start = gradientColors[i];
          const end = gradientColors[i + 1];

          if(value >= start.pos && value <= end.pos) {
            const ratio = (value - start.pos) / (end.pos - start.pos);
            return interpolateColor(start.color, end.color, ratio);
          }
        }
        return gradientColors[gradientColors.length - 1].color;
      }

      function interpolateColor(color1: string, color2: string, factor: number) {
        const c1 = hexToRgb(color1);
        const c2 = hexToRgb(color2);
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        return `rgb(${r}, ${g}, ${b})`;
      }

      function hexToRgb(color: string) {
        const hex = color.replace('#', '');
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return {r, g, b};
      }
    }

    colorPickSliderContainer.append(colorPickSlider);
    colorButtonsContainer.append(colorPickSliderContainer);


    const showColorPicker = () => {
      colorButtonsContainer.classList.add('inactive');
      colorPickSliderContainer.classList.remove('inactive');
    }

    const hideColorPicker = () => {
      colorButtonsContainer.classList.remove('inactive');
      colorPickSliderContainer.classList.add('inactive');
    }

    const changeCurrentColor = (color: string) => {
      colorPickContainer.style.backgroundColor = color;
    }

    const creataeColorButtonContext = (buttons: HTMLButtonElement[], onChange: (button: HTMLButtonElement) => void) => {
      let activeButton = buttons[0];
      activeButton.classList.add('active');

      for(const button of buttons) {
        if(button != activeButton) {
          button.classList.add('inactive');
        }
        button.onclick = () => {
          if(activeButton == button) {
            if(activeButton == colorPickerButton) {
              activeButton.classList.remove('active');
              activeButton.classList.add('inactive');
              activeButton = buttons[0];
              activeButton.classList.add('active');
              activeButton.classList.remove('inactive');
              changeCurrentColor('rgb(255, 255, 255)');
              hideColorPicker();
            }
            return;
          };

          if(button == colorPickerButton) {
            showColorPicker();
          } else if(activeButton == colorPickerButton) {
            hideColorPicker();
          }

          activeButton.classList.remove('active');
          activeButton.classList.add('inactive');
          activeButton = button;
          if(activeButton == colorPickerButton) {
            const initialInputEvent = new InputEvent('input');
            colorPickSlider.dispatchEvent(initialInputEvent);
          } else {
            changeCurrentColor((button.children[0] as HTMLElement).style.backgroundColor);
          }
          activeButton.classList.add('active');
          activeButton.classList.remove('inactive');
          onChange(button);
        }
      }
    }

    const createColorButton = (color: string) => {
      const button = document.createElement('button');
      button.classList.add('color-button');

      const buttonCore = document.createElement('div');
      buttonCore.classList.add('color-button-core');

      button.append(buttonCore);

      buttonCore.style.backgroundColor = color;
      button.style.backgroundColor = `${color}10`;
      ripple(button);
      colorButtonsContainer.append(button);

      return button;
    }

    creataeColorButtonContext([
      createColorButton('#FFFFFF'),
      createColorButton('#FE4438'),
      createColorButton('#FF8901'),
      createColorButton('#FFD60A'),
      createColorButton('#33C759'),
      createColorButton('#62E5E0'),
      createColorButton('#0A84FF'),
      createColorButton('#BD5CF3'),
      colorPickerButton
    ], () => {});

    colorPickContainer.append(colorButtonsContainer, colorPickSliderContainer, colorPickerButton);
    container.append(colorPickContainer);
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
