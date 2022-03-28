import { StateManager } from './services/StateManager';
import { genApp } from './App';
import { initRegistry } from './services/Registry';
import { initApiService } from './services/apiService';
import { initGlobalHandlerMap } from './services/handler';
import { UtilMethodManager } from './services/UtilMethodManager';
import { AppHooks, UtilMethod } from './types';
import { enableES5, setAutoFreeze } from 'immer';
import './style.css';

enableES5();
setAutoFreeze(false);

export type SunmaoUIRuntimeProps = {
  dependencies?: Record<string, any>;
  utilMethods?: UtilMethod<any>[];
  hooks?: AppHooks;
};

export function initSunmaoUI(props: SunmaoUIRuntimeProps = {}) {
  const stateManager = new StateManager(props.dependencies);
  const globalHandlerMap = initGlobalHandlerMap();
  const apiService = initApiService();
  const utilMethodManager = new UtilMethodManager(apiService);
  const eleMap = new Map<string, HTMLElement>();
  const registry = initRegistry(
    {
      stateManager,
      globalHandlerMap,
      apiService,
      eleMap,
    },
    utilMethodManager
  );
  const hooks = props.hooks;

  return {
    App: genApp(
      {
        registry,
        stateManager,
        globalHandlerMap,
        apiService,
        eleMap,
      },
      hooks
    ),
    stateManager,
    registry,
    globalHandlerMap,
    apiService,
    eleMap,
  };
}

export * from './utils/parseTypeBox';
export * from './utils/buildKit';
export * from './utils/encodeDragDataTransfer';
export * from './types';
export * from './types/traitPropertiesSchema';
export * from './constants';
export * from './services/Registry';
export * from './services/StateManager';
export { ModuleRenderer } from './components/_internal/ModuleRenderer';
export { default as Text, TextPropertySchema } from './components/_internal/Text';

// TODO: check this export
export { watch } from './utils/watchReactivity';
