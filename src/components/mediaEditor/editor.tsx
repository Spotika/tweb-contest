import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import {EditEvent, EnhanceEvent, EnhanceFilters} from './panel';
import Icon from '../icon';
import windowSize from '../../helpers/windowSize';

// const Editor = (params :{
//   file: File
// }) => {
//   let canvas: HTMLCanvasElement;


//   createEffect(async() => {
//     // create image from file
//     const img = new Image();
//     const url = await apiManagerProxy.invoke('createObjectURL', params.file);
//     await renderImageFromUrlPromise(img, url);

//     // draw image on canvas
//     canvas.width = img.width;
//     canvas.height = img.height;
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(img, 0, 0);
//   });

//   return <>
//     <canvas ref={canvas}></canvas>
//   </>
// };

type PropertiesType = {
  enhance: {
    canvas?: HTMLCanvasElement;
    needsRender: boolean,
    renderTimeout: number,
    values: {
      [key in EnhanceEvent['filter']]: number;
    };
    program?: WebGLProgram;
    positionLocation?: number;
    texCoordLocation?: number;
    textureSizeLocation?: WebGLUniformLocation;
    brightnessLocation?: WebGLUniformLocation;
    contrastLocation?: WebGLUniformLocation;
    enhanceLocation?: WebGLUniformLocation;
    saturationLocation?: WebGLUniformLocation;
    warmthLocation?: WebGLUniformLocation;
    fadeLocation?: WebGLUniformLocation;
    highlightsLocation?: WebGLUniformLocation;
    shadowsLocation?: WebGLUniformLocation;
    vingetteLocation?: WebGLUniformLocation;
    grainLocation?: WebGLUniformLocation;
    sharpenLocation?: WebGLUniformLocation;
    positionBuffer?: WebGLBuffer;
    texCoordBuffer?: WebGLBuffer;
  },
  crop: {
    canvas?: HTMLCanvasElement;
    panel: HTMLDivElement,
    activeCorner: null | 'rt' | 'lt' | 'lb' | 'rb' | 'center',
    mouseDownPos: {
      x: number;
      y: number;
    } | null,
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    realRotation: number;
    bufferRotation: number;
    mirror: number;
    degreeMarksContainer: HTMLDivElement | null;
    bufferMirror: number;
    panelElements: HTMLElement[];
    panelRotationTicks: number;
    realMirror: number;
    rotationAnimationInProgress: boolean,
    mirrorAnimationInProgress: boolean,
    enabled: boolean,
    onFreeCallback: () => void,
    ratio: {
      type: 'free' | 'original';
    } | {
      type: 'custom';
      x: number;
      y: number;
    }
  },
  brush: {
    canvas?: HTMLCanvasElement;
    selectedTool: 'pen' | 'arrow' | 'brush' | 'neon' | 'blur' | 'eraser',
    size: number;
    paths: {
      path: {
        x: number;
        y: number;
        size: number;
      }[];
      color: string;
      tool: PropertiesType['brush']['selectedTool']
    }[];
    mouseDown: boolean;
    selectedColor: string;
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
  };
  text: {
    canvas?: HTMLCanvasElement
    onDoubleClick: (e: MouseEvent) => void;
    objects: SVGElement[];
    // onMouseMove: (e: MouseEvent) => void;
    // onMouseUp: (e: MouseEvent) => void;
  };
};

class Editor {
  public canvas: HTMLCanvasElement;
  public itemDiv: HTMLElement;
  public refreshIntervalId: ReturnType<typeof setInterval>;

  private sourceImage: HTMLImageElement;
  private canvasContainer: HTMLDivElement;
  private saveEvent: (event: EditEvent) => void;
  private programInfo: any;
  static imagePadding: number = 16;

  private properties: PropertiesType = {
    enhance: {
      values: {} as any,
      renderTimeout: 10,
      needsRender: false
    },
    crop: {
      panel: document.createElement('div'),
      activeCorner: null,
      mouseDownPos: null,
      onFreeCallback: () => {},
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: Math.PI,
      rotationAnimationInProgress: false,
      panelElements: [],
      degreeMarksContainer: null,
      panelRotationTicks: 0,
      mirror: -1,
      bufferMirror: 0,
      realMirror: -1,
      realRotation: Math.PI,
      bufferRotation: 0,
      mirrorAnimationInProgress: false,
      enabled: false,
      ratio: {
        type: 'free'
      }
    },
    brush: {
      selectedTool: 'pen',
      size: 15,
      paths: [],
      mouseDown: false,
      selectedColor: 'white',
      onMouseMove: this.brushMouseMove.bind(this),
      onMouseDown: this.brushMouseDown.bind(this),
      onMouseUp: this.brushMouseUp.bind(this)
    },
    text: {
      onDoubleClick: this.textOnDoubleClick.bind(this),
      objects: []
    }
  };

  constructor(file: File, renderElement: HTMLElement) {
    this.itemDiv = document.createElement('div');
    this.itemDiv.classList.add('editor-container');

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.classList.add('canvas-container');

    this.itemDiv.append(this.canvasContainer);

    this.canvas = document.createElement('canvas');
    this.canvasContainer.append(this.canvas);

    // init pipeline values
    const createCropPanel = () => {
      const cropPanel = this.properties.crop.panel;
      cropPanel.classList.add('crop-panel');
      this.itemDiv.append(cropPanel);

      const flipIcon = document.createElement('div');
      flipIcon.append(Icon('cropflip'));
      flipIcon.classList.add('icon-button');
      flipIcon.onclick = this.cropFlip.bind(this);

      const rotateIcon = document.createElement('div');
      rotateIcon.append(Icon('croprotate'));
      rotateIcon.classList.add('icon-button');
      rotateIcon.onclick = this.cropRotate.bind(this);


      // degree scale creation
      const degreeScale = document.createElement('div');
      degreeScale.classList.add('degree-scale');
      cropPanel.append(rotateIcon, degreeScale, flipIcon);

      degreeScale.addEventListener('wheel', (e: WheelEvent) => {
        const sign = Math.sign(e.deltaY);
        this.rotateCropPanel(sign);
      });

      const cursorIcon = Icon('cursor');
      const cursor = document.createElement('div');
      cursor.classList.add('cursor');
      cursor.append(cursorIcon);
      degreeScale.append(cursor);

      const degreeMarksContainer = document.createElement('div');
      this.properties.crop.degreeMarksContainer = degreeMarksContainer;
      degreeMarksContainer.classList.add('degree-marks-container');
      degreeScale.append(degreeMarksContainer);

      const marksCount = 12;
      const marksStep = 6;
      const markGap = 4;

      const mainMarksList: HTMLElement[] = [];
      const subMarksList = []

      for(let i = -marksCount; i < marksCount + 1; i++) {
        const markContainer = document.createElement('div');
        markContainer.classList.add('degree-mark-container');

        const mark = document.createElement('div');
        mark.classList.add('degree-mark');
        markContainer.append(mark);
        degreeMarksContainer.append(markContainer);
        this.properties.crop.panelElements.push(markContainer);
        markContainer.style.left = `${i * (2 * marksStep + markGap * (marksStep + 1)) + i * 2 - 1}px`;
        mainMarksList.push(markContainer);

        if(i == marksCount) {
          continue;
        }

        // submarks
        for(let j = 0; j < marksStep; j++) {
          const subMarkContainer = document.createElement('div');
          subMarkContainer.classList.add('degree-mark-container');

          const submark = document.createElement('div');
          submark.classList.add('degree-mark');
          subMarkContainer.append(submark);
          degreeMarksContainer.append(subMarkContainer);
          this.properties.crop.panelElements.push(subMarkContainer);
          const markContainerLeft = i * (2 * marksStep + markGap * (marksStep + 1)) + i * 2 - 1;
          subMarkContainer.style.left = `${markContainerLeft + (j + 1) * markGap + (j + 1) * 2}px`;
          submark.style.backgroundColor = 'grey';
          subMarksList.push(subMarkContainer);
        }
      }


      function getTextWidth(input: string): number {
        const text = document.createElement('span');
        document.body.appendChild(text);

        text.style.fontSize = 12 + 'px';
        text.style.height = 'auto';
        text.style.width = 'auto';
        text.style.position = 'absolute';
        text.style.whiteSpace = 'no-wrap';
        text.style.fontWeight = '500';
        text.innerHTML = input;

        const width = Math.ceil(text.clientWidth);
        const formattedWidth = width;

        document.body.removeChild(text);
        return formattedWidth;
      }

      const minusWidth = getTextWidth('-');

      // numbers
      for(let i = 0; i < mainMarksList.length; ++i) {
        const degreeNumberContainer = document.createElement('div');
        degreeNumberContainer.classList.add('degree-number-container');

        const degreeNumber = document.createElement('div');
        degreeNumber.classList.add('degree-number');
        degreeNumber.textContent = `${15 * (i - marksCount)}°`;

        degreeNumberContainer.append(degreeNumber);
        degreeMarksContainer.append(degreeNumberContainer);

        this.properties.crop.panelElements.push(degreeNumberContainer);

        let textContentToCalc = degreeNumber.textContent.slice(0, -1);
        let additionalWidth = 0;
        if(textContentToCalc[0] == '-') {
          textContentToCalc = textContentToCalc.slice(1);
          additionalWidth = minusWidth;
        }
        const textWidth = getTextWidth(textContentToCalc);

        degreeNumberContainer.style.left = `${parseInt(mainMarksList[i].style.left.slice(0, -2)) - textWidth / 2 - additionalWidth}px`;
      }
    }
    createCropPanel();
    this.updateCropPanel();

    for(const filter of EnhanceFilters) {
      this.properties.enhance.values[filter] = 0;
    }


    renderElement.replaceWith(this.itemDiv);


    createEffect(async() => {
      this.sourceImage = new Image();
      const url = await apiManagerProxy.invoke('createObjectURL', file);
      await renderImageFromUrlPromise(this.sourceImage, url);

      // set size for result canvas
      const ctx = this.canvas.getContext('2d');
      this.canvas.width = this.sourceImage.width;
      this.canvas.height = this.sourceImage.height;

      // init all pipeline canvases and other props
      for(const layer of Object.keys(this.properties) as Array<keyof PropertiesType>) {
        const canvas = this.properties[layer].canvas = document.createElement('canvas');
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
      }

      this.properties.crop.width = this.sourceImage.width;
      this.properties.crop.height = this.sourceImage.height;

      // set timeout limitation for redrawing
      this.refreshIntervalId = setInterval((() => {
        if(this.properties.enhance.needsRender) {
          this.doEnhance();
          this.properties.enhance.needsRender = false;
        }
      }).bind(this), this.properties.enhance.renderTimeout);

      this.prepareShaders();

      this.doEnhance();
      this.enableCropMode();
      this.disableCropMode();

      // TODO: disable loader here
      // setTimeout(() => {
      //   alert(1)
      // }, 0);
    });
  }

  public setSaveEvent(saveEvent: (e: EditEvent) => void) {
    this.saveEvent = saveEvent;
  }

  private rotateCropPanel(ticks: number) {
    const props = this.properties.crop;
    const oldTicks = props.panelRotationTicks;

    props.panelRotationTicks += ticks;
    props.panelRotationTicks = Math.max(-84, Math.min(84, props.panelRotationTicks));

    if(oldTicks == props.panelRotationTicks) {
      return;
    }

    const rotation = Math.PI / 84 * ticks;
    props.bufferRotation += rotation;
    props.realRotation += rotation;
    this.updateCropPanel();
    if(!props.rotationAnimationInProgress) {
      this.cropRotateBuffer();
    }
  }

  private updateCropPanel() {
    const props = this.properties.crop;

    props.degreeMarksContainer.style.left = `${props.panelRotationTicks * 6}px`;

    for(const element of props.panelElements) {
      const left = parseInt(element.style.left.slice(0, -2)) + 6 * props.panelRotationTicks + 1;

      const opacity = Math.max(0, (1 - Math.abs(left / 200)));
      element.style.opacity = `${opacity}`;


      // increase font size for cursor element

      if(element.classList.contains('degree-number-container')) {
        // if(Math.abs(left) < 400) {
        const k = 1 - Math.abs(left) / 1000;
        element.style.fontSize = `${12 + 4 * k}px`;
        element.style.top = `-${5 * k}px`;
      }
    }
  }

  public processEvent(e: EditEvent) {
    switch(e.type) {
      case 'enhance':
        this.properties.enhance.values[e.filter] = e.value;
        this.properties.enhance.needsRender = true;
        break;
      case 'crop':
        if(e.data == 'original' || e.data == 'free') {
          this.properties.crop.ratio.type = e.data;
        } else {
          const [stringX, stringY] = e.data.split('_');
          const [x, y] = [parseInt(stringX), parseInt(stringY)];
          this.properties.crop.ratio = {
            type: 'custom',
            x,
            y
          };
        }
        this.processCropEvent();
    }
  }

  private processCropEvent() {
    const props = this.properties.crop;
    if(props.ratio.type == 'original') {
      this.properties.crop.x = 0;
      this.properties.crop.y = 0;
      this.properties.crop.width = this.canvas.width - 2 * Editor.imagePadding;
      this.properties.crop.height = this.canvas.height - 2 * Editor.imagePadding;
    } else if(props.ratio.type == 'custom') {
      props.x = 0;
      props.y = 0
      if(props.ratio.x / props.ratio.y <= this.sourceImage.width / this.sourceImage.height) {
        props.width = Math.floor(props.ratio.x / props.ratio.y * this.sourceImage.height);
        props.height = this.sourceImage.height;
      } else {
        props.height = Math.floor(props.ratio.y / props.ratio.x * this.sourceImage.width);
        props.width = this.sourceImage.width;
      }
    }

    this.doCrop();
    this.doCrop();
  }

  private prepareShaders() {
    const gl = this.properties.enhance.canvas.getContext('webgl');
    const props = this.properties.enhance;

    const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
    `;

    const fragmentShaderSource = `
precision mediump float;

varying vec2 v_texCoord;
varying vec2 uv;
uniform sampler2D u_image;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_enhance;
uniform float u_grain;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_sharpen;
uniform float u_warmth;
uniform float u_vingette;
uniform float u_fade;
uniform vec2 u_textureSize; // New uniform for texture size

mat4 saturationMatrix( float saturation )
{
    vec3 luminance = vec3( 0.3086, 0.6094, 0.0820 );
    float oneMinusSat = 1.0 - saturation;
    vec3 red = vec3( luminance.x * oneMinusSat );
    red += vec3( saturation, 0, 0 );
    vec3 green = vec3( luminance.y * oneMinusSat );
    green += vec3( 0, saturation, 0 );
    vec3 blue = vec3( luminance.z * oneMinusSat );
    blue += vec3( 0, 0, saturation );
    return mat4( red, 0,
                 green, 0,
                 blue, 0,
                 0, 0, 0, 1 );
}

float rand(vec2 uv, float t) {
    return fract(sin(dot(uv, vec2(1225.6548, 321.8942))) * 4251.4865 + t);
}

vec3 adjustHighlights(vec3 color, float highlights) {
    float luminance = dot(color, vec3(0.3, 0.59, 0.11));
    float factor = smoothstep(0.5, 1.0, luminance);
    return mix(color, color + highlights * factor, factor);
}

vec3 adjustShadows(vec3 color, float shadows) {
    float luminance = dot(color, vec3(0.3, 0.59, 0.11));
    float factor = smoothstep(0.0, 0.5, luminance);
    return mix(color, color - shadows * factor, factor);
}

float sdSquare(vec2 point, float width) {
	vec2 d = abs(point) - width;
	return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

vec4 vignette(vec4 color, vec2 uv, float vignette) {
  float d = length(uv - 0.5) * -1.0;
  vec4 overlay = vec4(d, d, d, vignette);

  return mix(color, overlay, overlay.a);
}

vec3 applySharpen(vec2 uv, float sharpen, vec2 texel) {
    mat3 kernel = mat3(
        0.0, -1.0,  0.0,
       -1.0,  5.0, -1.0,
        0.0, -1.0,  0.0
    );

    vec3 result = vec3(0.0);
    for(int i = -1; i <= 1; i++) {
        for(int j = -1; j <= 1; j++) {
            vec2 offset = vec2(float(i), float(j)) * texel;
            result += texture2D(u_image, uv + offset).rgb * kernel[i+1][j+1];
        }
    }

    vec3 original = texture2D(u_image, uv).rgb;
    return mix(original, result, sharpen);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // apply Sharpen
    vec2 texel = 1.0 / u_textureSize;
    color.rgb = applySharpen(v_texCoord, u_sharpen, texel);

    // Apply enhance
    float contrast = 1.0 + u_enhance; // Increase contrast
    float brightness = u_enhance * 30.0; // Increase brightness
    float saturation = 1.0 + u_enhance; // Increase saturation
    float r = color.r * 255.0;
    float g = color.g * 255.0;
    float b = color.b * 255.0;

    r += brightness;
    g += brightness;
    b += brightness;

    r = ((r - 128.0) * contrast) + 128.0;
    g = ((g - 128.0) * contrast) + 128.0;
    b = ((b - 128.0) * contrast) + 128.0;

    float avg = 0.299 * r + 0.587 * g + 0.114 * b;
    r = avg + (r - avg) * saturation;
    g = avg + (g - avg) * saturation;
    b = avg + (b - avg) * saturation;

    color.r = max(0.0, min(255.0, r)) / 255.0;
    color.g = max(0.0, min(255.0, g)) / 255.0;
    color.b = max(0.0, min(255.0, b)) / 255.0;

    // Apply brightness
    color.rgb += u_brightness;

    // Apply contrast
    color.rgb = ((color.rgb - 0.5) * max(u_contrast + 1.0, 0.0)) + 0.5;

    // Apply saturation
    color = saturationMatrix(u_saturation + 1.0) * color;

    // Apply highlights
    color.rgb = adjustHighlights(color.rgb, u_highlights);

    // Apply shadows
    color.rgb = adjustShadows(color.rgb, u_shadows);

    // Apply vignette
    color = vignette(color, v_texCoord, u_vingette);

    // Apply grain
    float grain = rand(v_texCoord, u_grain);
    color.rgb += grain * u_grain - (u_grain * 0.5);

    // Aplly warmth
    float value = -u_warmth / 5.0;
    color.r = min(255.0, max(0.0, color.r - value));
    color.b = min(255.0, max(0.0, color.b + value));

    // Apply fade
    color.rgb = mix(color.rgb, vec3(0.0, 0.0, 0.0), u_fade * 1.0);

    gl_FragColor = color;
}
`;

    function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl: WebGLRenderingContext, vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram | null {
      const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
      const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
      if (!vertexShader || !fragmentShader) return null;
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Error linking program:', gl.getProgramInfoLog(program));
          gl.deleteProgram(program);
          return null;
      }
      return program;
    }

    props.program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!props.program) throw new Error('Failed to create program');

    props.positionLocation = gl.getAttribLocation(props.program, 'a_position');
    props.texCoordLocation = gl.getAttribLocation(props.program, 'a_texCoord');
    props.brightnessLocation = gl.getUniformLocation(props.program, 'u_brightness');
    props.contrastLocation = gl.getUniformLocation(props.program, 'u_contrast');
    props.enhanceLocation = gl.getUniformLocation(props.program, 'u_enhance');
    props.saturationLocation = gl.getUniformLocation(props.program, 'u_saturation');
    props.warmthLocation = gl.getUniformLocation(props.program, 'u_warmth');
    props.fadeLocation = gl.getUniformLocation(props.program, 'u_fade');
    props.highlightsLocation = gl.getUniformLocation(props.program, 'u_highlights');
    props.shadowsLocation = gl.getUniformLocation(props.program, 'u_shadows');
    props.sharpenLocation = gl.getUniformLocation(props.program, 'u_sharpen');
    props.vingetteLocation = gl.getUniformLocation(props.program, 'u_vingette');
    props.grainLocation = gl.getUniformLocation(props.program, 'u_grain');
    props.sharpenLocation = gl.getUniformLocation(props.program, 'u_sharpen');
    props.textureSizeLocation = gl.getUniformLocation(props.program, "u_textureSize");


    props.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, props.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ]), gl.STATIC_DRAW);

    props.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, props.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        1, 1,
    ]), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // * pipeline functions (in their order)
  private doEnhance() {
    const props = this.properties.enhance;
    const gl = this.properties.enhance.canvas.getContext('webgl');

    const values = props.values;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(props.program);

    gl.enableVertexAttribArray(props.positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, props.positionBuffer);
    gl.vertexAttribPointer(props.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(props.texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, props.texCoordBuffer);
    gl.vertexAttribPointer(props.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(props.brightnessLocation, values.Brightness / 100);
    gl.uniform1f(props.contrastLocation, values.Contrast / 100);
    gl.uniform1f(props.saturationLocation, values.Saturation / 100);
    gl.uniform1f(props.enhanceLocation, values.Enhance / 100);
    gl.uniform1f(props.fadeLocation, values.Fade / 100);
    gl.uniform1f(props.grainLocation, values.Grain / 100);
    gl.uniform1f(props.highlightsLocation, values.Highlights / 100);
    gl.uniform1f(props.shadowsLocation, values.Shadows / 100);
    gl.uniform1f(props.sharpenLocation, values.Sharpen / 100 * 4);
    gl.uniform1f(props.vingetteLocation, values.Vingette / 100);
    gl.uniform1f(props.warmthLocation, values.Warmth / 100);
    gl.uniform2f(props.textureSizeLocation, this.sourceImage.width, this.sourceImage.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.doCrop();
  }

  private drawBrushPath(paths: PropertiesType['brush']['paths'] | 'extendLastPath', drawArrows: boolean = false) {
    const props = this.properties.brush;
    const ctx = props.canvas.getContext('2d');

    let beginPathFrom = 1;

    if(paths == 'extendLastPath') {
      var newPaths = [props.paths[props.paths.length - 1]];
      beginPathFrom = newPaths[0].path.length - 1
    } else {
      var newPaths = paths;
    }

    for(const pathObj of newPaths) {
      const {path, color, tool} = pathObj;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      for(let i = beginPathFrom; i < path.length; i++) {
        const prevPoint = path[i - 1];
        const currentPoint = path[i];
        ctx.lineWidth = props.size;

        if(tool == 'pen' || tool == 'arrow') {
          ctx.beginPath();
          ctx.arc(prevPoint.x, prevPoint.y, props.size / 2, 0, Math.PI * 2);
          ctx.arc(currentPoint.x, currentPoint.y, props.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.closePath();

          ctx.beginPath();
          ctx.moveTo(prevPoint.x, prevPoint.y);
          ctx.lineTo(currentPoint.x, currentPoint.y);
          ctx.stroke();
          ctx.closePath()
        }
      }

      if(tool == 'arrow' && drawArrows && pathObj.path.length > 1) {
        // TODO: add accurate to arrow head and change arrow head form

        const fromX = path[path.length - 2].x, fromY = path[path.length - 2].y;
        const toX = path[path.length - 1].x, toY = path[path.length - 1].y;

        const headLength = 10;
        const angle = Math.atan2(toY - fromY, toX - fromX);

        // Draw the main line

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Draw the arrow head
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.stroke();
        ctx.fill();
      }
    }
  }


  private doBrush() {
    const props = this.properties.brush;
    const ctx = props.canvas.getContext('2d');

    ctx.clearRect(0, 0, props.canvas.width, props.canvas.height);

    this.drawBrushPath(props.paths, true);

    this.doCrop();
  }

  private doCrop() {
    // const prevCanvas: HTMLCanvasElement = this.properties.brush.canvas;

    // * create merge canvas
    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = this.properties.enhance.canvas.width;
    mergeCanvas.height = this.properties.enhance.canvas.height;

    const mergeCtx = mergeCanvas.getContext('2d');
    mergeCtx.drawImage(this.properties.enhance.canvas, 0, 0);
    mergeCtx.drawImage(this.properties.brush.canvas, 0, 0);

    // final pipeline state
    const mainCtx = this.canvas.getContext('2d');
    const ctx = this.properties.crop.canvas.getContext('2d');

    // clear main and crop canvases
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    mainCtx.restore();

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, -Editor.imagePadding, -Editor.imagePadding);
    ctx.clearRect(0, 0, ctx.canvas.width * 2, ctx.canvas.height * 2);
    ctx.clearRect(0, 0, ctx.canvas.width * 2, ctx.canvas.height * 2);
    ctx.restore();

    const rotationCanvas = document.createElement('canvas');
    rotationCanvas.width = ctx.canvas.width;
    rotationCanvas.height = ctx.canvas.height;
    const rotationCtx = rotationCanvas.getContext('2d');
    const props = this.properties.crop;

    const xAX = Math.cos(props.rotation);
    const xAY = Math.sin(props.rotation);
    rotationCtx.setTransform(xAX * props.mirror, xAY * props.mirror, -xAY, xAX, this.properties.crop.canvas.width / 2 - Editor.imagePadding, this.properties.crop.canvas.height / 2 - Editor.imagePadding);
    rotationCtx.drawImage(mergeCanvas, -mergeCanvas.width / 2, -mergeCanvas.height / 2);


    if(this.properties.crop.enabled) {
      ctx.drawImage(rotationCanvas, 0, 0);
      this.drawCropInterface();
    } else {
      ctx.drawImage(rotationCanvas, 0, 0);
    }

    mainCtx.drawImage(ctx.canvas, -Editor.imagePadding, -Editor.imagePadding);

    rotationCanvas.remove();
    mergeCanvas.remove();
  }


  public async getModifiedFile(newFileName: string): Promise<File> {
    this.disableCropMode();

    return fetch(this.canvas.toDataURL())
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], newFileName, blob);
      return file;
    });
  }

  public linkCropFreeCallback(callback: () => void) {
    this.properties.crop.onFreeCallback = callback;
  }

  private drawCropInterface() {
    const props = this.properties.crop;

    const ctx = props.canvas.getContext('2d');

    let [cropX, cropY, cropWidth, cropHeight] = [props.x, props.y, props.width, props.height];

    if(cropWidth < 0) {
      cropWidth = -cropWidth;
      cropX -= cropWidth;
    }
    if(cropHeight < 0) {
      cropHeight = -cropHeight;
      cropY -= cropHeight;
    }

    const rect = this.canvas.getBoundingClientRect();
    const k = this.canvas.width / rect.width;

    const drawPoint = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 4 * Math.sqrt(k), 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    }

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();
    }
    // draw points and lines

    // draw dimmed rects
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, props.canvas.width, cropY);
    ctx.fillRect(0, cropY + cropHeight, props.canvas.width, props.canvas.height);
    ctx.fillRect(0, cropY, cropX, cropHeight);
    ctx.fillRect(cropX + cropWidth, cropY, props.canvas.width - cropX - cropWidth, cropHeight);

    ctx.fill();

    const dh = cropHeight / 3;
    const dw = cropWidth / 3;
    drawLine(cropX, cropY, cropX + cropWidth, cropY);
    drawLine(cropX + 1, cropY + dh, cropX + cropWidth - 1, cropY + dh);
    drawLine(cropX + 1, cropY + dh * 2, cropX + cropWidth - 1, cropY + dh * 2);

    drawLine(cropX, cropY, cropX, cropY + cropHeight);
    drawLine(cropX + dw, cropY + 1, cropX + dw, cropY + cropHeight - 1);
    drawLine(cropX + dw * 2, cropY + 1, cropX + dw * 2, cropY + cropHeight - 1);


    drawLine(cropX + cropWidth, cropY, cropX + cropWidth, cropY + cropHeight);
    drawLine(cropX, cropY + cropHeight, cropX + cropWidth, cropY + cropHeight);

    drawPoint(cropX, cropY);
    drawPoint(cropX + cropWidth, cropY);
    drawPoint(cropX, cropY + cropHeight);
    drawPoint(cropX + cropWidth, cropY + cropHeight);
  }

  private cropCanvasMouseMove(e: MouseEvent) {
    const props = this.properties.crop;

    if(props.activeCorner == null) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left, relY =  e.clientY - rect.top;
    let x = Math.floor(relX * this.canvas.width / rect.width - Editor.imagePadding);
    let y = Math.floor(relY * this.canvas.height / rect.height - Editor.imagePadding);

    x = Math.max(0, Math.min(x, this.canvas.width - 2 * Editor.imagePadding));
    y = Math.max(0, Math.min(y, this.canvas.height - 2 * Editor.imagePadding));

    let [newX, newY, newWidth, newHeight] = [props.x, props.y, props.width, props.height];

    if(props.activeCorner != 'center' && props.ratio.type == 'original') {
      props.onFreeCallback();
    }

    if(props.activeCorner == 'lb') {
      newWidth = props.width + props.x - x;
      newHeight = y - props.y;
      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
      newX = props.width + props.x - newWidth;
    } else if(props.activeCorner == 'lt') {
      newWidth = props.width - x + props.x;
      newHeight = props.height - y + props.y;

      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }

      newX = props.width + props.x - newWidth;
      newY = props.height + props.y - newHeight;
    } else if(props.activeCorner == 'rb') {
      newWidth = x - props.x;
      newHeight = y - props.y;

      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
    } else if(props.activeCorner == 'rt') {
      newY = y;
      newWidth = x - props.x;
      newHeight -= y - props.y;

      newWidth = x - props.x;
      newHeight = props.height + props.y - y;
      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
      newY = props.height + props.y - newHeight;
    } else if(props.activeCorner == 'center') {
      if(props.mouseDownPos == null) {
        return;
      }
      const dx = x - props.mouseDownPos.x;
      const dy = y - props.mouseDownPos.y;
      newX += dx;
      newY += dy;
      newX = Math.max(0, Math.min(newX, this.canvas.width - Editor.imagePadding));
      newY = Math.max(0, Math.min(newY, this.canvas.height - Editor.imagePadding));

      if(newX + newWidth > this.canvas.width - 2 * Editor.imagePadding) {
        newX = this.canvas.width - 2 * Editor.imagePadding - newWidth;
      }
      if(newY + newHeight > this.canvas.height - 2 * Editor.imagePadding) {
        newY = this.canvas.height - 2 * Editor.imagePadding - newHeight;
      }

      if(newX + newWidth < 0) {
        newX = -newWidth;
      }
      if(newY + newHeight < 0) {
        newY = -newHeight;
      }

      props.mouseDownPos = {x: x, y: y};
    }

    if(newX + newWidth > this.canvas.width - 2 * Editor.imagePadding) {
      newWidth = this.canvas.width - 2 * Editor.imagePadding - newX;
    }
    if(newY + newHeight > this.canvas.height - 2 * Editor.imagePadding) {
      newHeight = this.canvas.height - 2 * Editor.imagePadding - newY;
    }

    props.width = newWidth;
    props.height = newHeight;
    props.x = newX;
    props.y = newY;

    this.doCrop();
  }

  private cropCanvasMouseDown(e: MouseEvent) {
    const props = this.properties.crop;
    const intersectRadius = 12;
    if(props.activeCorner != null) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left, relY =  e.clientY - rect.top;
    const x = relX * this.canvas.width / rect.width - Editor.imagePadding;
    const y = relY * this.canvas.height / rect.height - Editor.imagePadding;

    const intersect = (x1: number, y1: number) => {
      if(((x1 - x) ** 2 + (y1 - y) ** 2) < intersectRadius ** 2) {
        return true;
      }
      return false;
    }

    if(intersect(props.x, props.y)) {
      props.activeCorner = 'lt';
    } else if(intersect(props.x + props.width, props.y)) {
      props.activeCorner = 'rt';
    } else if(intersect(props.x, props.y + props.height)) {
      props.activeCorner = 'lb';
    } else if(intersect(props.x + props.width, props.y + props.height)) {
      props.activeCorner = 'rb';
    }

    // center
    if(
      (x > props.x + 5 && x < props.x + props.width - 5 && y > props.y + 5 && y < props.y + props.height - 5) ||
      (x < props.x - 5 && x > props.x + props.width + 5 && y < props.y + 5 && y > props.y + props.height - 5)
    ) {
      props.activeCorner = 'center';
      props.mouseDownPos = {
        x: Math.floor(x),
        y: Math.floor(y)
      };
    }
  }

  private cropCanvasMouseUp(e: Event) {
    const props = this.properties.crop;
    props.activeCorner = null;
  }

  private cropRotateBuffer() {
    let prevTimeStamp: number = undefined
    const props = this.properties.crop;
    props.rotationAnimationInProgress = true;

    const animate = (timeStamp: number) => {
      if(prevTimeStamp === undefined) {
        prevTimeStamp = timeStamp;
      }

      const elapsed = timeStamp - prevTimeStamp;
      if(elapsed === 0) {
        return window.requestAnimationFrame(animate);
      }

      if(Math.abs(props.bufferRotation) < 0.005) {
        props.rotation = props.realRotation;
        props.bufferRotation = 0;
        props.rotationAnimationInProgress = false;
        this.properties.crop.ratio.type = 'original';
        this.processCropEvent();
        this.enableCropMode();
        this.doCrop();
        return;
      }

      let dr = props.bufferRotation * elapsed * 0.01;
      if(Math.abs(dr) > Math.abs(props.bufferRotation)) {
        dr = props.bufferRotation;
      }
      props.bufferRotation -= dr;
      props.rotation += dr;
      this.enableCropMode();
      this.properties.crop.ratio.type = 'original';
      this.processCropEvent();

      prevTimeStamp = timeStamp;
      this.doCrop();
      return window.requestAnimationFrame(animate);
    }
    window.requestAnimationFrame(animate);
  }

  private cropRotate() {
    const props = this.properties.crop;
    const rotation = Math.PI / 2;
    props.bufferRotation += rotation;
    props.realRotation += rotation;
    if(!props.rotationAnimationInProgress) {
      this.cropRotateBuffer();
    }
  }

  public enableCropMode(): void {
    const props = this.properties.crop;
    props.enabled = true;
    this.canvasContainer.classList.add('crop-mode');
    props.panel.classList.add('active');

    const sin = Math.abs(Math.sin(props.rotation));
    const cos = Math.abs(Math.cos(props.rotation));

    this.canvas.width = this.sourceImage.width * cos + this.sourceImage.height * sin + 2 * Editor.imagePadding;
    this.canvas.height = this.sourceImage.width * sin + this.sourceImage.height * cos + 2 * Editor.imagePadding;

    props.canvas.width = this.canvas.width;
    props.canvas.height = this.canvas.height;

    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, Editor.imagePadding, Editor.imagePadding);

    const cropCtx = props.canvas.getContext('2d');
    cropCtx.setTransform(1, 0, 0, 1, Editor.imagePadding, Editor.imagePadding);

    // add event listeners
    this.canvas.onmousedown = this.cropCanvasMouseDown.bind(this);
    this.canvasContainer.onmouseup = this.cropCanvasMouseUp.bind(this);
    this.canvasContainer.onmousemove = this.cropCanvasMouseMove.bind(this);
    this.doCrop();
  }

  public cropFlip() {
    this.properties.crop.bufferMirror += -2 * this.properties.crop.realMirror;
    this.properties.crop.realMirror = -this.properties.crop.realMirror;

    let prevTimeStamp: number;

    const animate = (timeStamp: number) => {
      if(prevTimeStamp === undefined) {
        prevTimeStamp = timeStamp;
        return window.requestAnimationFrame(animate);
      }

      const elapsed = timeStamp - prevTimeStamp;
      if(elapsed == 0) {
        return window.requestAnimationFrame(animate);
      }

      if(Math.abs(this.properties.crop.bufferMirror) < 0.01) {
        this.properties.crop.bufferMirror = 0;
        this.properties.crop.mirrorAnimationInProgress = false;
        this.properties.crop.mirror = this.properties.crop.realMirror;
        this.doCrop();
        return;
      }
      const dm = this.properties.crop.bufferMirror / 4 * elapsed * 0.01;
      this.properties.crop.mirror += dm;
      this.properties.crop.bufferMirror -= dm;

      requestAnimationFrame(animate);
      this.doCrop();
    }

    if(!this.properties.crop.mirrorAnimationInProgress) {
      window.requestAnimationFrame(animate);
    }

    this.doCrop();
  }

  public disableCropMode(): void {
    const props = this.properties.crop;
    props.enabled = false;
    this.canvasContainer.classList.remove('crop-mode');
    props.panel.classList.remove('active');
    if(this.properties.crop.canvas === undefined) {
      return;
    }
    this.canvas.onmousedown = null;
    this.canvasContainer.onmouseup = null;
    this.canvasContainer.onmousedown = null;
    const ctx = this.canvas.getContext('2d');

    let [cropX, cropY, cropWidth, cropHeight] = [props.x, props.y, props.width, props.height];

    if(cropWidth < 0) {
      cropWidth = -cropWidth;
      cropX -= cropWidth;
    }
    if(cropHeight < 0) {
      cropHeight = -cropHeight;
      cropY -= cropHeight;
    }

    this.canvas.width = cropWidth;
    this.canvas.height = cropHeight;
    ctx.setTransform(1, 0, 0, 1, -cropX, -cropY);

    this.doCrop();
  }

  public changeBrushTool(tool: PropertiesType['brush']['selectedTool']) {
    this.properties.brush.selectedTool = tool;
  }

  public changeBrushSize(size: number) {
    this.properties.brush.size = size;
  }

  private brushMouseMove(e: MouseEvent) {
    const props = this.properties.brush;

    if (!props.mouseDown) return;

    const path = props.paths[props.paths.length - 1].path;

    const rect = this.canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left + this.properties.crop.x;
    const relY = e.clientY - rect.top + this.properties.crop.y;

    let x1 = relX * this.canvas.width / rect.width;
    let y1 = relY * this.canvas.height / rect.height;

    const rotation = this.properties.crop.rotation;

    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);


    // TODO: create transition from wrapper canvas to wrapped canvas

    let x = cos*x1 - sin*y1;
    let y = sin*x1 + cos*y1;

    // console.log(x, y, props.canvas.width, props.canvas.height, sin, cos);


    if(sin > 0 && cos > 0) {
      const w = sin * props.canvas.width;
      x += sin * w;
      y -= cos * w;
    } else if(sin < 0 && cos > 0) {
      // const w = props.canvas.height * cos;
      // x +=
      // y -= w * cos;
      // x -= w * sin;
    }

    path.push({
        x, y,
        size: props.size
    });
    this.drawBrushPath('extendLastPath');
    this.doCrop();
}


  private brushMouseDown() {
    const props = this.properties.brush;

    props.mouseDown = true;
    props.paths.push({
      color: props.selectedColor,
      path: [],
      tool: props.selectedTool
    });
  }

  private brushMouseUp() {
    const props = this.properties.brush;

    props.mouseDown = false;
    this.doBrush();
  }

  public enableBrushMode() {
    const props = this.properties.brush;

    this.canvas.addEventListener('mousemove', props.onMouseMove);
    this.canvas.addEventListener('mousedown', props.onMouseDown);
    this.canvas.addEventListener('mouseup', props.onMouseUp);
  }

  public disableBrushMode() {
    const props = this.properties.brush;

    this.canvas.removeEventListener('mousemove', props.onMouseMove);
    this.canvas.removeEventListener('mousedown', props.onMouseDown);
    this.canvas.removeEventListener('mouseup', props.onMouseUp);
  }

  public setBrushColor(color: string) {
    this.properties.brush.selectedColor = color;
  }

  public enableTextMode() {
    const props = this.properties.text;
    this.canvas.addEventListener('dblclick', props.onDoubleClick);
  }

  public disableTextMode() {
    const props = this.properties.text;
    this.canvas.removeEventListener('dblclick', props.onDoubleClick);
  }

  private textOnDoubleClick(event: MouseEvent) {
    alert(1);
  }
}

export default Editor;
