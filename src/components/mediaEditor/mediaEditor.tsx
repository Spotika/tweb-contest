import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import Panel, {EditorProperties} from './panel';
import Editor from './editor';
import {ButtonIconTsx} from '../buttonIconTsx';


const MediaEditor = (
  params: {
    parentElement: HTMLElement,
    file: File,
    saveModifiedFile: (file: File) => void
  }
) => {
  let editor: Editor;
  let panel: Panel;
  let editorContainer: HTMLDivElement;
  let panelContainer: HTMLDivElement;
  const properties: EditorProperties = {
    enhance: [{
      filter: 'Enhance',
      min: '0',
      max: '100',
      splitPrecent: 0,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Brightness',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Contrast',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Saturation',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Warmth',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Fade',
      min: '0',
      max: '100',
      splitPrecent: 0,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Highlights',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Shadows',
      min: '-100',
      max: '100',
      splitPrecent: 50,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Vingette',
      min: '0',
      max: '100',
      splitPrecent: 0,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Grain',
      min: '0',
      max: '100',
      splitPrecent: 0,
      onChange(newValue) {
        console.log(newValue);
      }
    }, {
      filter: 'Sharpen',
      min: '0',
      max: '100',
      splitPrecent: 0,
      onChange(newValue) {
        console.log(newValue);
      }
    }]
  };


  createEffect(() => {
    editor = new Editor(params.file, editorContainer);
    panel = new Panel(panelContainer, properties, exitEditor);
  });

  const exitEditor = () => {
    params.parentElement.remove();
  }

  return <>
    <div ref={editorContainer}></div>
    <div ref={panelContainer}></div>
    <ButtonIconTsx onclick={async() => {
      params.saveModifiedFile(await editor.getModifiedFile(params.file.name))
      exitEditor();
    }} class="save" icon="check1"/>
  </>
};

export default MediaEditor;
