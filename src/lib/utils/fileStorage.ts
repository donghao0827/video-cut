import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, normalize, isAbsolute } from 'path';

// 基础存储目录配置
const STORAGE_CONFIG = {
  // 默认存储根目录（绝对路径）
  baseStorageDir: process.env.STORAGE_BASE_DIR || join(process.cwd(), 'storage'),
  
  // 公共存储目录（相对于public目录）
  publicStorageDir: process.env.PUBLIC_STORAGE_DIR || 'uploads',
  
  // 是否允许访问任意路径（默认只允许在baseStorageDir下）
  allowAnyPath: process.env.ALLOW_ANY_PATH === 'true',
  
  // 默认目录
  defaultDirs: {
    subtitles: 'subtitles',
    videos: 'videos',
    audios: 'audios',
    processed: 'processed',
    temp: 'temp'
  }
};

/**
 * 获取规范化的存储路径
 * @param path 用户指定的路径
 * @param options 选项
 * @returns 规范化后的绝对路径
 */
export async function getStoragePath(
  path: string = STORAGE_CONFIG.defaultDirs.processed, 
  options: {
    createIfNotExist?: boolean;
    isPublic?: boolean;
    ensureIsSubdir?: boolean;
  } = {}
): Promise<string> {
  const {
    createIfNotExist = true,
    isPublic = false,
    ensureIsSubdir = true
  } = options;

  let resolvedPath: string;

  // 处理公共目录路径
  if (isPublic) {
    // 确保在public/uploads目录下
    const publicBase = join(process.cwd(), 'public', STORAGE_CONFIG.publicStorageDir);
    resolvedPath = isAbsolute(path) 
      ? path                                 // 如果是绝对路径直接使用
      : join(publicBase, normalize(path));   // 如果是相对路径，加上public基础路径
    
    // 安全检查：确保路径是public基础路径的子目录
    if (ensureIsSubdir && !resolvedPath.startsWith(publicBase) && !STORAGE_CONFIG.allowAnyPath) {
      throw new Error('安全限制：不允许访问public目录之外的路径');
    }
  } else {
    // 处理私有存储路径
    resolvedPath = isAbsolute(path)
      ? path                                             // 如果是绝对路径直接使用
      : join(STORAGE_CONFIG.baseStorageDir, path);       // 如果是相对路径，加上私有存储基础路径
    
    // 安全检查：确保路径是存储基础路径的子目录
    if (ensureIsSubdir && !resolvedPath.startsWith(STORAGE_CONFIG.baseStorageDir) && !STORAGE_CONFIG.allowAnyPath) {
      throw new Error('安全限制：不允许访问存储根目录之外的路径');
    }
  }

  // 路径规范化
  resolvedPath = normalize(resolvedPath);

  // 如果需要，确保目录存在
  if (createIfNotExist && !existsSync(resolvedPath)) {
    try {
      await mkdir(resolvedPath, { recursive: true });
    } catch (error) {
      console.error('创建目录失败:', error);
      throw new Error(`无法创建存储目录: ${resolvedPath}`);
    }
  }

  return resolvedPath;
}

/**
 * 获取文件的存储路径
 * @param fileName 文件名
 * @param directory 目录名
 * @param options 选项
 * @returns 完整的文件路径
 */
export async function getFileStoragePath(
  fileName: string,
  directory: string = STORAGE_CONFIG.defaultDirs.processed,
  options: {
    createIfNotExist?: boolean;
    isPublic?: boolean;
  } = {}
): Promise<string> {
  const dirPath = await getStoragePath(directory, options);
  return join(dirPath, fileName);
}

/**
 * 获取用于Web访问的公共URL路径
 * @param filePath 存储路径
 * @returns Web可访问的URL
 */
export function getPublicUrlFromPath(filePath: string): string {
  // 获取public目录下的相对路径
  const publicBasePath = join(process.cwd(), 'public');
  
  if (!filePath.startsWith(publicBasePath)) {
    throw new Error('指定的文件不在public目录中，无法生成公共URL');
  }

  // 移除public前缀并替换反斜杠
  const relativePath = filePath.substring(publicBasePath.length).replace(/\\/g, '/');
  
  // 确保以/开头
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
}

/**
 * 获取处理后文件的默认存储目录
 * @param type 文件类型
 * @param isPublic 是否存储在公共目录
 * @returns 存储目录路径
 */
export async function getDefaultStorageDir(
  type: 'subtitle' | 'video' | 'audio' | 'processed' | 'temp',
  isPublic: boolean = false
): Promise<string> {
  let subdir: string;
  
  switch (type) {
    case 'subtitle':
      subdir = STORAGE_CONFIG.defaultDirs.subtitles;
      break;
    case 'video':
      subdir = STORAGE_CONFIG.defaultDirs.videos;
      break;
    case 'audio':
      subdir = STORAGE_CONFIG.defaultDirs.audios;
      break;
    case 'processed':
      subdir = STORAGE_CONFIG.defaultDirs.processed;
      break;
    case 'temp':
      subdir = STORAGE_CONFIG.defaultDirs.temp;
      break;
    default:
      subdir = STORAGE_CONFIG.defaultDirs.processed;
  }
  
  return getStoragePath(subdir, { isPublic });
}
