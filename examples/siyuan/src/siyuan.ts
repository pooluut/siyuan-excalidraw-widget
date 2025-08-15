// 获取内容块ID
import { loadFromBlob, MIME_TYPES } from "@excalidraw/excalidraw";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";

export function getBlockId(): string | null {
  return getBlockIdFromUrl() || getBlockIdFromParentDom();
}

// 从url获取块ID
export function getBlockIdFromUrl(): string | null {
  return getURLSearchParams("id");
}

export function getURLSearchParams(param: string): string | null {
  return new URLSearchParams(window.location.search).get(param);
}

// 从iframe的父Dom获取块ID
export function getBlockIdFromParentDom(): string | null {
  const parentDom = window.frameElement?.parentElement?.parentElement;
  return parentDom?.getAttribute("data-node-id") || null;
}


// 获取assets内容
export function getExcalidrawContent(blockId: string): Promise<string> {
  return getBlockAttrs(blockId).then((value: BlockAttrs) => {
    const assert = value["data-assets"];
    return assert ? getFile(assert) : Promise.resolve("");
  });
}

export function getRestoreDataState(
  blockId: string | null
): Promise<RestoredDataState> {
  if (!blockId) {
    return Promise.resolve({} as RestoredDataState);
  }

  new Promise(resolve => setTimeout(resolve, 1000));

  return getExcalidrawContent(blockId).then((excalidraw_str: string) => {
    if (!excalidraw_str || excalidraw_str === "") {
      return {} as RestoredDataState;
    }
    return loadFromBlob(
      new Blob([excalidraw_str], { type: MIME_TYPES.excalidraw }),
      null,
      null,
      null
    );
  });
}



// 获取块属性
export function getBlockAttrs(blockId: string): Promise<BlockAttrs> {
  return fetch("/api/attr/getBlockAttrs", {
    body: JSON.stringify({
      id: blockId,
    }),
    method: "POST",
  })
    .then((response) => {
      return response.json();
    })
    .then((e) => {
      const dataAssets = e.data["data-assets"] || e.data["custom-data-assets"];
      return { "data-assets": dataAssets };
    });
}

// 设置块属性
export function setBlockAttrs(attrs: BlockAttrs): Promise<Response> {
  // const options = JSON.stringify(attrs.options);
  const dataAssets = attrs["data-assets"];
  const body = JSON.stringify({
    id: getBlockId(),
    attrs: {
      "data-assets": dataAssets,
      "custom-data-assets": dataAssets,
      // options: options,
      // "custom-options": options,
    },
  });
  return fetch("/api/attr/setBlockAttrs", {
    body: body,
    method: "POST",
  });
}

// 获取文件内容
export function getFile(path: string): Promise<string> {
  return fetch("/api/file/getFile", {
    method: "POST",
    body: JSON.stringify({
      path: `data/${path}`,
    }),
  }).then((response) => {
    return response.text();
  });
}


// 上传资源文件
export function assetsUpload(
  base64Encoded: boolean,
  filename: string,
  filedata: string
): Promise<string> {
  let mimeType: string = MIME_TYPES.excalidraw;

  const blob = base64Encoded
    ? (() => {
        // base64 to Blob
        const bytes = atob(filedata);
        const ab = new ArrayBuffer(bytes.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < bytes.length; i++) {
          ia[i] = bytes.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeType });
      })()
    : new Blob([filedata], { type: mimeType });
  const file = new File([blob], filename, { lastModified: Date.now() });

  const formdata = new FormData();
  formdata.append("assetsDirPath", "/assets/");
  formdata.append("file[]", file);

  return fetch("/api/asset/upload", {
    method: "POST",
    body: formdata,
  })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const assetsPath: string = data?.data?.succMap?.[filename];
      return assetsPath;
    });
}

// 判断是否开启授权
export async function isAuthEnable(): Promise<boolean> {
  const reponse = await fetch("/api/attr/getBlockAttrs", {
    body: JSON.stringify({
      id: getBlockId(),
    }),
    method: "POST",
  });
  return reponse.status === 401;
}

// ------

export declare type BlockAttrs = {
  "data-assets": string;
  // options: Options;
};

export declare type Options = {
  gridModeEnabled: boolean;
  exportBackground: boolean;
  theme: string;
};

/**
 * 判断是否为思源链接
 * @param url 要检查的URL字符串
 * @returns 如果是思源链接返回true，否则返回false
 */
export function isSiyuanLink(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // 检查是否为思源协议链接
  return url.startsWith('siyuan://');
}

/**
 * 判断是否为思源块链接
 * @param url 要检查的URL字符串
 * @returns 如果是思源块链接返回true，否则返回false
 */
export function isSiyuanBlockLink(url: string): boolean {
  if (!isSiyuanLink(url)) {
    return false;
  }
  
  // 检查是否为块链接格式: siyuan://blocks/{blockId}
  const blockLinkRegex = /^siyuan:\/\/blocks\/(\d+-[a-z0-9]+)$/;
  return blockLinkRegex.test(url);
}

/**
 * 从思源块链接中提取块ID
 * @param url 思源块链接
 * @returns 块ID，如果不是有效的思源块链接则返回null
 */
export function extractBlockIdFromLink(url: string): string | null {
  if (!isSiyuanBlockLink(url)) {
    return null;
  }
  
  const match = url.match(/^siyuan:\/\/blocks\/(\d+-[a-z0-9]+)$/);
  return match ? match[1] : null;
}


/**
 * 从思源引用中提取信息
 * @param text 思源引用文本
 * @returns 包含blockId和text的对象，如果不是有效的思源引用则返回null
 */
export function extractSiyuanReference(text: string): { blockId: string; text: string;  } | null {
  const match = text.match(/^\(\((\d+-[a-z0-9]+)\s['"](.*)['"]\)\)$/);
  if (match) {
    return {
      blockId: match[1],
      text: match[2]
    };
  }
  
  return null;
}


/**
 * 从文本中提取所有思源引用
 * @param text 要检查的文本
 * @returns 包含所有思源引用的数组
 */
export function extractAllSiyuanReferences(text: string): Array<{ blockId: string; text: string; fullMatch: string }> {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const references: Array<{ blockId: string; text: string; fullMatch: string }> = [];
  const referenceRegex = /\(\((\d+-[a-z0-9]+)\s'([^']+)'\)\)/g;
  let match;
  
  while ((match = referenceRegex.exec(text)) !== null) {
    references.push({
      blockId: match[1],
      text: match[2],
      fullMatch: match[0]
    });
  }
  
  return references;
}
