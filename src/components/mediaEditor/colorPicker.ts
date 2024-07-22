import ColorPicker, {ColorPickerColor} from '../colorPicker';
import ripple from '../ripple';

type RGB = {
  r: number,
  g: number,
  b: number
};

function convertRgbStringToObject(rgbString: string): RGB {
  const rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
  const match = rgbString.match(rgbRegex);
  if(!match) {
    throw new Error('Invalid RGB format');
  }

  const [, r, g, b] = match.map(Number);
  if([r, g, b].some(value => value < 0 || value > 255)) {
    throw new Error('RGB values must be between 0 and 255');
  }

  return {
    r,
    g,
    b
  };
}


class EditorColorPicker {
  public container = document.createElement('div');

  public currentColor: RGB;

  private colorFromSlider: RGB;
  private blendWhite = 0;
  private blendBlack = 0;
  private onChange: (color: string) => void;


  constructor(onChange: (color: string) => void) {
    this.onChange = onChange;
    const container = this.container;

    // main containers
    const colorPickContainer = document.createElement('div');
    colorPickContainer.classList.add('color-pick-container');

    const colorButtonsContainer = document.createElement('div');
    colorButtonsContainer.classList.add('color-buttons-container');

    const buttonColorInputContainer = document.createElement('div');
    buttonColorInputContainer.classList.add('button-color-input-container');

    const canvasColorInputContainer = document.createElement('div');
    canvasColorInputContainer.classList.add('canvas-color-input-container', 'inactive');

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
    colorButtonsContainer.append(colorPickSliderContainer);

    buttonColorInputContainer.append(colorButtonsContainer, colorPickSliderContainer, colorPickerButton);
    colorPickContainer.append(buttonColorInputContainer);


    // color picker
    const colorPicker = new ColorPicker();
    colorPicker.onChange = (color) => {
      this.onChange(color.rgb);
    }

    // colorPicker.setColor(undefined);
    colorPicker.updatePicker();
    {
      const colorPickBox = colorPicker.container.getElementsByClassName('color-picker-box')[0] as SVGElement;
      colorPickBox.setAttribute('viewBox', '0 0 200 120');

      const colorPickRect = colorPicker.container.getElementsByTagName('rect')[2] as SVGRectElement;
      console.log(colorPickRect);
      colorPickRect.setAttribute('width', '200');
      colorPickRect.setAttribute('height', '120');

      colorPicker.container.classList.add('inactive');

      const colorSlider = colorPicker.container.getElementsByClassName('color-picker-color-slider')[0];
      colorSlider.setAttribute('viewBox', '0 0 304 20');
      colorPickSliderContainer.append(colorSlider);

      const colorSliderRect = colorSlider.getElementsByTagName('rect')[0] as SVGRectElement;
      colorSliderRect.setAttribute('rx', '10');
      colorSliderRect.setAttribute('ry', '10');
      colorSliderRect.setAttribute('y', '0');
      colorSliderRect.setAttribute('x', '0');
      colorSliderRect.setAttribute('height', '20');
      colorSliderRect.setAttribute('width', '304');


      const colorSliderCircle = colorSlider.getElementsByTagName('circle')[0] as SVGCircleElement;
      colorSliderCircle.setAttribute('r', '10');
      colorSliderCircle.setAttribute('r', '10');

      const colorPickerDragger = colorSlider.getElementsByClassName('color-picker-dragger')[0];
      colorPickerDragger.setAttribute('y', '10');
    }


    // color slider functional

    const showColorPicker = () => {
      colorButtonsContainer.classList.add('inactive');
      colorPickSliderContainer.classList.remove('inactive');
      colorPicker.container.classList.remove('inactive');
    }

    const hideColorPicker = () => {
      colorButtonsContainer.classList.remove('inactive');
      colorPickSliderContainer.classList.add('inactive');
      colorPicker.container.classList.add('inactive');
    }

    const changeCurrentColor = (color: RGB) => {
      // currentColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
      this.currentColor = {
        ...color
      };
    }

    const changeSliderColor = (color: RGB) => {
      // currentColorToProcess = `rgb(${color.r}, ${color.g}, ${color.b})`;
      this.colorFromSlider = {
        ...color
      };

      color.r = 255 * this.blendWhite + color.r * (1 - this.blendWhite);
      color.g = 255 * this.blendWhite + color.g * (1 - this.blendWhite);
      color.b = 255 * this.blendWhite + color.b * (1 - this.blendWhite);

      color.r = color.r * (1 - this.blendBlack);
      color.g = color.g * (1 - this.blendBlack);
      color.b = color.b * (1 - this.blendBlack);
      changeCurrentColor(color);
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
              changeCurrentColor({r: 255, g: 255, b: 255});
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
          } else {
            this.onChange((button.children[0] as HTMLElement).style.backgroundColor);
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

    // * create canvas color input

    colorPickContainer.append(canvasColorInputContainer);
    colorPickContainer.append(colorPicker.container);

    this.container = (colorPickContainer);
  }
};

export default EditorColorPicker;
