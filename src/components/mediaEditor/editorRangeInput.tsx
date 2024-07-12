
class RangeInput {
  public input: HTMLInputElement;
  public container: HTMLDivElement

  constructor(
    // input: {
      min: string,
      max: string,
      step: string,
      initialValue: string,
      splitPrecent: number
    // }
  ) {
    this.container = document.createElement('div')
    // params.renderElement.replaceWith(this.container);

    this.container.classList.add('editor-range-container');
    const range = document.createElement('input');
    this.input = range;

    range.type = 'range';
    range.value = initialValue;
    range.min = min;
    range.max = max;
    range.step = step;
    this.container.append(range);

    const secondaryTextColor = getComputedStyle(document.body).getPropertyValue('--secondary-text-color');
    this.container.style.setProperty('--slider-track-color', `${secondaryTextColor}10`);

    const rangeFill = document.createElement('div');
    rangeFill.className = 'editor-range-fill';
    this.container.appendChild(rangeFill);

    async function updateRangeFill() {
      const value = Number(range.value);
      const min = Number(range.min);
      const max = Number(range.max);
      const percentage = (value - min) / (max - min) * 100;

      if(percentage >= splitPrecent) {
        rangeFill.style.left = `${splitPrecent}%`;
        rangeFill.style.width = `calc(${percentage - splitPrecent}%)`;
      } else {
        rangeFill.style.left = `calc(${percentage}%)`;
        rangeFill.style.width = `calc(${splitPrecent - percentage}%)`;
      }
    }
    updateRangeFill();
    range.addEventListener('input', updateRangeFill);
  }
}

export default RangeInput;
