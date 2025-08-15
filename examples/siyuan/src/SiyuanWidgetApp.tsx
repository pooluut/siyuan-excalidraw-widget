import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  Children,
  cloneElement,
} from "react";

import type * as TExcalidraw from "@excalidraw/excalidraw";
import type {
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import type {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  Gesture,
  LibraryItems,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";


import * as siyuan from "./siyuan";

import {
  resolvablePromise,
  debounce,
} from "../utils";

import "./SiyuanWidgetApp.scss";

import type { ResolvablePromise } from "../utils";
import { ARROW_TYPE, FONT_FAMILY, ROUGHNESS, EVENT } from "@excalidraw/common";
import { ClipboardData } from "@excalidraw/excalidraw/clipboard";
import { isElementLink } from "@excalidraw/element";


export interface AppProps {
  useCustom: (api: ExcalidrawImperativeAPI | null, customArgs?: any[]) => void;
  customArgs?: any[];
  excalidrawLib: typeof TExcalidraw;
  children: React.ReactNode;
}



export default function SiyuanWidgetApp({
  useCustom,
  customArgs,
  excalidrawLib,
  children,
}: AppProps) {
  const {
    exportToCanvas,
    exportToSvg,
    exportToBlob,
    exportToClipboard,
    useHandleLibrary,
    useDevice,
    MIME_TYPES,
    sceneCoordsToViewportCoords,
    viewportCoordsToSceneCoords,
    restore,
    Sidebar,
    Footer,
    WelcomeScreen,
    MainMenu,
    LiveCollaborationTrigger,
    convertToExcalidrawElements,
    TTDDialog,
    TTDDialogTrigger,
    serializeAsJSON,
    loadSceneOrLibraryFromBlob,
  } = excalidrawLib;
  const appRef = useRef<any>(null);
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [renderScrollbars, setRenderScrollbars] = useState(false);
  const [disableImageTool, setDisableImageTool] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [pointerData, setPointerData] = useState<{
    pointer: { x: number; y: number };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  } | null>(null);

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: resolvablePromise<ExcalidrawInitialDataState | null>() });

  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  // 获取当前块ID
  const blockId = siyuan.getBlockId();

  useCustom(excalidrawAPI, customArgs);
  useHandleLibrary({ excalidrawAPI });

  // 用于存储上一次的状态
  const lastSavedStateRef = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles;
  } | null>(null);

  // 优化：只创建一次 debouncedSaveData 实例
  const saveData = useCallback(
    async (
      elements: readonly NonDeletedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      if (!blockId) return;

      // 检查elements和files是否有变化
      const hasChanges = !lastSavedStateRef.current || 
        JSON.stringify(elements) !== JSON.stringify(lastSavedStateRef.current.elements) ||
        JSON.stringify(files) !== JSON.stringify(lastSavedStateRef.current.files);

      if (!hasChanges) {
        return;
      }

      try {
        const json = serializeAsJSON(elements, appState, files, "local");
        const filename = `${blockId}.excalidraw`;
        const assetPath = await siyuan.assetsUpload(false, filename, json);
        if (assetPath) {
          await siyuan.setBlockAttrs({
            "data-assets": assetPath,
          });
          // 更新最后保存的状态
          lastSavedStateRef.current = {
            elements,
            files
          };
        }
      } catch (error) {
        console.error("保存Excalidraw数据失败:", error);
      }
    },
    [blockId]
  );

  // 只创建一次 debouncedSaveData 实例
  const debouncedSaveData = useRef(debounce(saveData, 2000)).current;

  // 包装统一接口
  const saveDataWrapper = useCallback(
    (
      elements: readonly NonDeletedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      immediate = false
    ) => {
      if (immediate) {
        saveData(elements, appState, files);
      } else {
        debouncedSaveData(elements, appState, files);
      }
    },
    [saveData, debouncedSaveData]
  );

  useEffect(() => {
    if (!excalidrawAPI || !blockId) {
      return;
    }

    siyuan.getRestoreDataState(blockId)
      .then(restoredData => {
        if (restoredData && restoredData.elements) {
          // 恢复已保存的数据
          initialStatePromiseRef.current.promise.resolve({
            elements: restoredData.elements,
            appState: {
              ...restoredData.appState,
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: FONT_FAMILY.Nunito,
              currentItemRoughness: ROUGHNESS.architect,
              currentItemStrokeWidth: 1,
              currentItemArrowType: ARROW_TYPE.round,
            },
            files: restoredData.files || {},
            scrollToContent: false,
          });
          lastSavedStateRef.current = {
            elements: restoredData.elements,
            files: restoredData.files || {},
          };
          setViewModeEnabled(true);
          setGridModeEnabled(false);

          initialStatePromiseRef.current.promise.then((initialData) => {
            if (initialData?.elements) {
              excalidrawAPI.scrollToContent(initialData.elements, { fitToContent: true });
            }
          });
        } else {
          // 初始化空画布
          window.frameElement.style.width = "1000px";
          window.frameElement.style.height = "400px";
          initialStatePromiseRef.current.promise.resolve({
            elements: [],
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: FONT_FAMILY.Nunito,
              currentItemRoughness: ROUGHNESS.architect,
              currentItemStrokeWidth: 1,
              currentItemArrowType: ARROW_TYPE.round,
            },
          });
          setViewModeEnabled(false);
          setGridModeEnabled(true);
        }
      })
      .catch(error => {
        console.error("恢复数据失败:", error);
      });
  }, [excalidrawAPI, blockId]);

  // 键盘事件处理函数
  const handleShiftKey = useCallback((event: KeyboardEvent) => {
    setIsShiftPressed(event.shiftKey);
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT.KEYDOWN, handleShiftKey);
    window.addEventListener(EVENT.KEYUP, handleShiftKey);

    return () => {
      window.removeEventListener(EVENT.KEYDOWN, handleShiftKey);
      window.removeEventListener(EVENT.KEYUP, handleShiftKey);
    };
  }, [handleShiftKey]);

  const onPaste = useCallback(
    (data: ClipboardData, event: ClipboardEvent) => {
      const match = siyuan.extractSiyuanReference(data.text);

      if (match && pointerData) {
        const text = match.text;
        const siyuan_url_link = `siyuan://blocks/${match.blockId}`;

        if (isShiftPressed) {
          // 按住 Shift 时创建矩形元素
          // 使用 excalidrawAPI 的方法来创建矩形
          data.elements = convertToExcalidrawElements([{
            type: "rectangle",
            x: pointerData.pointer.x,
            y: pointerData.pointer.y,
            width: 200,
            roughness: ROUGHNESS.architect,
            label: {
              text: text,
              fontFamily: FONT_FAMILY.Nunito,
            },
            link: siyuan_url_link,
          }]);
        } else {
          data.elements = convertToExcalidrawElements([{
            type: "text",
            x: pointerData.pointer.x,
            y: pointerData.pointer.y,
            text: text,
            fontFamily: FONT_FAMILY.Nunito,
            link: siyuan_url_link,
          }]);
        }
      }
      return true;
    },
    [isShiftPressed, pointerData, convertToExcalidrawElements]
  );

  const onPointerUpdate = useCallback((payload: {
    pointer: { x: number; y: number };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  }) => {
    setPointerData(payload);
  }, []);

  // 处理复选框变化并立即存储数据
  const handleCheckboxChange = useCallback(() => {
    const newViewMode = !viewModeEnabled;

    setViewModeEnabled(newViewMode);
    setGridModeEnabled(!newViewMode);

    // 立即存储数据
    if (newViewMode && blockId && excalidrawAPI) {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      saveDataWrapper(elements, appState, files, true);
    }
  }, [excalidrawAPI, blockId, debouncedSaveData, viewModeEnabled]);

  const onChange = useCallback((
    elements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (!viewModeEnabled) {
      saveDataWrapper(elements, appState, files, false);
    }
  }, [viewModeEnabled, debouncedSaveData]);

  const renderExcalidraw = (children: React.ReactNode) => {
    const Excalidraw: any = Children.toArray(children).find(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type !== "string" &&
        //@ts-ignore
        child.type.displayName === "Excalidraw",
    );

    if (!Excalidraw) {
      return null;
    }

    return cloneElement(
      Excalidraw,
      {
        excalidrawAPI: (api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api),
        initialData: initialStatePromiseRef.current.promise,
        onPaste,
        onChange,
        onPointerUpdate,
        gridModeEnabled,
        viewModeEnabled,
        renderScrollbars,
        zenModeEnabled,
        name: "Custom name of drawing",
        UIOptions: {
          canvasActions: { loadScene: false },
          tools: { image: !disableImageTool },
        },
        onLinkOpen: (element: NonDeletedExcalidrawElement,
          event: CustomEvent<{
            nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
          }>
        ) => {
          if (element.link) {
            event.preventDefault();
            if (isElementLink(element.link)) {
              excalidrawAPI?.scrollToContent(element.link, { animate: true });
            } else if (siyuan.isSiyuanLink(element.link)) {
              parent.openFileByURL(`${element.link}`);
            }
          }
        }
      },
      null,
    );
  };

  return (
    <div className="App" ref={appRef}>
      {renderExcalidraw(children)}

      <div className="checkbox-container">
        <input
          type="checkbox"
          checked={viewModeEnabled}
          onChange={handleCheckboxChange}
        />
        <span style={{ fontSize: '14px', userSelect: 'none' }}></span>
      </div>
    </div>
  );
}
