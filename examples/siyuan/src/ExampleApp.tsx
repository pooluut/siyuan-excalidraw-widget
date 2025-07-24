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
} from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  Gesture,
  LibraryItems,
  BinaryFiles,
  PointerDownState as ExcalidrawPointerDownState,
} from "@excalidraw/excalidraw/types";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

import * as siyuan from "./siyuan";

import {
  resolvablePromise,
  distance2d,
  fileOpen,
  withBatchedUpdates,
  withBatchedUpdatesThrottled,
} from "../utils";

import "./ExampleApp.scss";

import type { ResolvablePromise } from "../utils";
import { ARROW_TYPE, FONT_FAMILY, ROUGHNESS } from "@excalidraw/common";


export interface AppProps {
  useCustom: (api: ExcalidrawImperativeAPI | null, customArgs?: any[]) => void;
  customArgs?: any[];
  excalidrawLib: typeof TExcalidraw;
  children: React.ReactNode;
}

export default function ExampleApp({
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
  const onChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [renderScrollbars, setRenderScrollbars] = useState(false);
  // const [theme, setTheme] = useState<Theme>("light");
  const [disableImageTool, setDisableImageTool] = useState(false);

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  // 获取当前块ID
  const blockId = siyuan.getBlockId();

  useCustom(excalidrawAPI, customArgs);

  useHandleLibrary({ excalidrawAPI });

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    if (blockId) {
      // 如果有BlockID，尝试恢复之前的绘图数据

      siyuan.getRestoreDataState(blockId)
        .then(restoredData => {
          if (restoredData && restoredData.elements) {
            // 如果有保存的数据，则恢复
            initialStatePromiseRef.current.promise.resolve({
              elements: restoredData.elements || [],
              appState: restoredData.appState || {},
              files: restoredData.files || {},
              scrollToContent: true,
            });
            setViewModeEnabled(true);
            setGridModeEnabled(false);

            // console.log("已恢复保存的绘图数据");
          } else {
            // console.log("新建的画布");
            // 否则初始化一个空的画布
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
    } else {
      console.error("没有BlockID");
    }
    
    // 组件卸载时清除定时器
    return () => {
      if (onChangeTimeoutRef.current) {
        clearTimeout(onChangeTimeoutRef.current);
        onChangeTimeoutRef.current = null;
      }
    };
  }, [excalidrawAPI, blockId]);

  const renderExcalidraw = (children: React.ReactNode) => {
    const Excalidraw: any = Children.toArray(children).find(
      (child) =>
        React.isValidElement(child) &&
        typeof child.type !== "string" &&
        //@ts-ignore
        child.type.displayName === "Excalidraw",
    );
    if (!Excalidraw) {
      return;
    }
    const newElement = cloneElement(
      Excalidraw,
      {
        excalidrawAPI: (api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api),
        initialData: initialStatePromiseRef.current.promise,
        onChange: (
          elements: readonly NonDeletedExcalidrawElement[],
          appState: AppState,
          files: BinaryFiles,
        ) => {
          if (!blockId) {
            return;
          }
          
          // 导出为.excalidraw格式
          if (excalidrawAPI) {
            // 防抖处理，避免频繁保存
            if (onChangeTimeoutRef.current) {
              clearTimeout(onChangeTimeoutRef.current);
            }
            
            onChangeTimeoutRef.current = setTimeout(async () => {
              try {
                const json = serializeAsJSON(elements, appState, files, "local");
                // 生成文件名（使用块ID作为文件名）
                const filename = `${blockId}.excalidraw`;
                
                // 上传到SiYuan资源文件夹
                const assetPath = await siyuan.assetsUpload(
                  false, // 不使用base64编码
                  filename,
                  json
                );
                
                // 更新块属性，存储资源路径
                if (assetPath) {
                  await siyuan.setBlockAttrs({
                    "data-assets": assetPath,
                  });
                  
                }
              } catch (error) {
                console.error("保存Excalidraw数据失败:", error);
              }
            }, 2000); // 1秒延迟，防抖
          }
        },
        gridModeEnabled,
        viewModeEnabled,
        renderScrollbars,
        zenModeEnabled,
        name: "Custom name of drawing",
        UIOptions: {
          canvasActions: {
            loadScene: false,
          },
          tools: { image: !disableImageTool },
        },
        onLinkOpen,
        validateEmbeddable: true,
      },
      null,
    );

    return (
      <>
        {newElement}
        <div className="checkbox-container">
          <label style={{ display: 'flex', alignItems: 'center', padding: '0 0px' }}>
            <input
              type="checkbox"
              checked={viewModeEnabled}
              onChange={() => {
                  setViewModeEnabled(!viewModeEnabled);
                  setGridModeEnabled(!gridModeEnabled);
                }
              }
              style={{ marginRight: '5px' }}
            />
            <span style={{ fontSize: '14px', userSelect: 'none' }}></span>
          </label>
        </div>
      </>
    );
  };

  const onLinkOpen = useCallback(
    (
      element: NonDeletedExcalidrawElement,
      event: CustomEvent<{
        nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
      }>,
    ) => {
      const link = element.link!;
      const { nativeEvent } = event.detail;
      const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
      const isNewWindow = nativeEvent.shiftKey;
      const isInternalLink =
        link.startsWith("/") || link.includes(window.location.origin);
      if (isInternalLink && !isNewTab && !isNewWindow) {
        // signal that we're handling the redirect ourselves
        event.preventDefault();
        // do a custom redirect, such as passing to react-router
        // ...
      }
    },
    [],
  );


  return (
    <div className="App" ref={appRef}>
      {renderExcalidraw(children)}

      {/* <button
            onClick={async () => {
              if (!excalidrawAPI) {
                return;
              }
              const svg = await exportToSvg({
                elements: excalidrawAPI?.getSceneElements(),
                appState: {
                  ...initialData.appState,
                  exportWithDarkMode,
                  exportEmbedScene,
                  width: 300,
                  height: 100,
                },
                files: excalidrawAPI?.getFiles(),
              });
              appRef.current.querySelector(".export-svg").innerHTML =
                svg.outerHTML;
            }}
          >
            Export to SVG
          </button> */}
      {/* <div className="export export-svg"></div> */}

    </div>
  );
}
