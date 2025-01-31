import {createEffect} from 'solid-js'
import Panel, {EditorProperties, EnhanceProperties} from './panel';
import Editor from './editor';
import {ButtonIconTsx} from '../buttonIconTsx';


const MediaEditor = (
  params: {
    parentElement: HTMLElement,
    file: File,
    saveModifiedFile: (file: File) => void
    exitEditor: () => void
  }
) => {
  let editor: Editor;
  let panel: Panel;
  let editorContainer: HTMLDivElement;
  let panelContainer: HTMLDivElement;

  createEffect(() => {
    editor = new Editor(params.file, editorContainer);
    panel = new Panel(panelContainer, editor, exitEditor);
  });

  const exitEditor = () => {
    clearInterval(editor.refreshIntervalId);
    params.parentElement.remove();
    params.exitEditor();
  }

  return <>
    <div ref={editorContainer}></div>
    <div ref={panelContainer}></div>
    <ButtonIconTsx onclick={async() => {
      params.saveModifiedFile(await editor.getModifiedFile(params.file.name));
      exitEditor();
    }} class="save" icon="check1"/>
  </>
};

export default MediaEditor;
