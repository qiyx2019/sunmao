import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { watch } from '@vue-reactivity/watch';
import { RuntimeApplication } from '@meta-ui/core';
import { merge } from 'lodash';
import { TraitResult } from '../modules/registry';
import {
  ApplicationComponent,
  ComponentWrapperType,
  MetaUIModules,
  SlotsMap,
} from '../types/RuntimeSchema';

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type ApplicationTrait = ArrayElement<ApplicationComponent['traits']>;

type ImplWrapperProps = {
  component: ApplicationComponent;
  slotsMap: SlotsMap | undefined;
  targetSlot: { id: string; slot: string } | null;
  mModules: MetaUIModules;
  app?: RuntimeApplication;
  componentWrapper?: ComponentWrapperType;
  onLayoutChange?: (id: string, layout: any) => void;
};

export const ImplWrapper = React.forwardRef<HTMLDivElement, ImplWrapperProps>(
  (props, ref) => {
    const {
      component: c,
      slotsMap,
      targetSlot,
      app,
      children,
      componentWrapper: ComponentWrapper,
      mModules,
      onLayoutChange,
    } = props;

    const { registry, stateManager, globalHandlerMap, apiService } = props.mModules;

    const Impl = registry.getComponent(c.parsedType.version, c.parsedType.name).impl;

    if (!globalHandlerMap.has(c.id)) {
      globalHandlerMap.set(c.id, {});
    }

    let handlerMap = globalHandlerMap.get(c.id)!;
    useEffect(() => {
      const handler = (s: { componentId: string; name: string; parameters?: any }) => {
        if (s.componentId !== c.id) {
          return;
        }
        if (!handlerMap[s.name]) {
          // maybe log?
          return;
        }
        handlerMap[s.name](s.parameters);
      };
      apiService.on('uiMethod', handler);
      return () => {
        apiService.off('uiMethod', handler);
        globalHandlerMap.delete(c.id);
      };
    }, []);

    const mergeState = useCallback(
      (partial: any) => {
        stateManager.store[c.id] = { ...stateManager.store[c.id], ...partial };
      },
      [c.id]
    );
    const subscribeMethods = useCallback((map: any) => {
      handlerMap = { ...handlerMap, ...map };
      globalHandlerMap.set(c.id, handlerMap);
    }, []);

    // result returned from traits
    const [traitResults, setTraitResults] = useState<TraitResult[]>(() => {
      return c.traits.map(trait =>
        excecuteTrait(trait, stateManager.deepEval(trait.properties).result)
      );
    });

    function excecuteTrait(
      trait: ApplicationTrait,
      traitProperty: ApplicationTrait['properties']
    ) {
      const tImpl = registry.getTrait(
        trait.parsedType.version,
        trait.parsedType.name
      ).impl;
      return tImpl({
        ...traitProperty,
        componentId: c.id,
        mergeState,
        subscribeMethods,
        mModules,
      });
    }

    // eval traits' properties then excecute traits
    useEffect(() => {
      const stops: ReturnType<typeof watch>[] = [];
      const properties: Array<ApplicationTrait['properties']> = [];
      c.traits.forEach((t, i) => {
        const { result, stop } = stateManager.deepEval(
          t.properties,
          ({ result: property }: any) => {
            const traitResult = excecuteTrait(t, property);
            setTraitResults(oldResults => {
              // assume traits number and order will not change
              const newResults = [...oldResults];
              newResults[i] = traitResult;
              return newResults;
            });
            stops.push(stop);
          }
        );
        properties.push(result);
      });
      // although traitResults has initialized in useState, it must be set here again
      // because mergeState will be called during the first render of component, and state will change
      setTraitResults(c.traits.map((trait, i) => excecuteTrait(trait, properties[i])));
      return () => stops.forEach(s => s());
    }, [c.traits]);

    // reduce traitResults
    const propsFromTraits: TraitResult['props'] = useMemo(() => {
      return Array.from(traitResults.values()).reduce(
        (prevProps, result: TraitResult) => {
          if (!result.props) {
            return prevProps;
          }

          let effects = prevProps?.effects || [];
          if (result.props?.effects) {
            effects = effects?.concat(result.props?.effects);
          }
          return {
            ...prevProps,
            ...result.props,
            effects,
          };
        },
        {} as TraitResult['props']
      );
    }, [traitResults]);

    // component properties
    const [evaledComponentProperties, setEvaledComponentProperties] = useState(() => {
      return merge(stateManager.deepEval(c.properties).result, propsFromTraits);
    });

    // eval component properties
    useEffect(() => {
      const { result, stop } = stateManager.deepEval(
        c.properties,
        ({ result: newResult }: any) => {
          setEvaledComponentProperties({ ...newResult });
        }
      );
      // must keep this line, reason is the same as above
      setEvaledComponentProperties({ ...result });
      return stop;
    }, [c.properties]);

    const mergedProps = { ...evaledComponentProperties, ...propsFromTraits };

    const C = (
      <Impl
        key={c.id}
        component={c}
        {...mergedProps}
        mModules={mModules}
        mergeState={mergeState}
        subscribeMethods={subscribeMethods}
        onLayoutChange={onLayoutChange}
        slotsMap={slotsMap}
        app={app}
      />
    );

    if (targetSlot && app) {
      const targetC = app.spec.components.find(c => c.id === targetSlot.id);
      if (targetC?.parsedType.name === 'grid_layout') {
        return (
          <div key={c.id} data-meta-ui-id={c.id} ref={ref} {...props}>
            {C}
            {children}
          </div>
        );
      }
    }

    const result = (
      <React.Fragment key={c.id}>
        {C}
        {children}
      </React.Fragment>
    );

    if (ComponentWrapper) {
      return <ComponentWrapper id={c.id}>{result}</ComponentWrapper>;
    }

    return result;
  }
);
