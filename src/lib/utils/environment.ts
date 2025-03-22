/**
 * 环境检测工具函数
 */

/**
 * 检查是否是服务器环境
 * 在服务器端，typeof window 为 'undefined'
 */
export const isServer = () => typeof window === 'undefined';

/**
 * 检查是否是客户端环境
 */
export const isClient = () => typeof window !== 'undefined';

/**
 * 检查是否在开发环境中运行
 */
export const isDevelopment = () => 
  process.env.NODE_ENV === 'development';

/**
 * 检查是否在生产环境中运行
 */
export const isProduction = () => 
  process.env.NODE_ENV === 'production';

/**
 * 检查是否应该使用离线任务进行字幕生成
 * 根据环境变量SUBTITLE_USE_OFFLINE_TASKS决定
 */
export const shouldUseOfflineTasks = () => {
  // 如果明确设置了环境变量，则使用它的值
  if (typeof process.env.SUBTITLE_USE_OFFLINE_TASKS !== 'undefined') {
    return process.env.SUBTITLE_USE_OFFLINE_TASKS === 'true';
  }
  
  // 默认在生产环境中使用离线任务，在开发环境中不使用
  return isProduction();
};

/**
 * 获取API基础URL
 */
export const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
}; 