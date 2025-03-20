import ObsClient from 'esdk-obs-nodejs';

// 环境变量配置
const accessKeyId = process.env.HW_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.HW_SECRET_ACCESS_KEY || '';
const server = process.env.HW_OBS_ENDPOINT || ''; // 例如: 'https://obs.cn-north-4.myhuaweicloud.com'
const bucketName = process.env.HW_OBS_BUCKET || '';
// 默认URL过期时间（秒），可通过环境变量配置
const defaultExpires = parseInt(process.env.HW_OBS_URL_EXPIRES || '3600', 10); // 默认1小时

let obsClientInstance: ObsClient | null = null;

/**
 * 获取OBS客户端单例
 */
export function getObsClient(): ObsClient {
  if (!obsClientInstance) {
    obsClientInstance = new ObsClient({
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      server,
    });
  }
  return obsClientInstance;
}

/**
 * 创建临时访问URL
 * @param key 对象的Key
 * @param expires 过期时间（秒）
 * @returns 临时访问URL
 */
export async function createTemporaryUrl(
  key: string,
  expires: number = defaultExpires
): Promise<string> {
  if (!accessKeyId || !secretAccessKey || !server || !bucketName) {
    throw new Error('OBS configuration missing');
  }

  const obsClient = getObsClient();
  
  try {
    const result = await obsClient.createSignedUrl({
      Method: 'GET',
      Bucket: bucketName,
      Key: key,
      Expires: expires
    });
    
    if (result.CommonMsg.Status < 300 && result.InterfaceResult.SignedUrl) {
      return result.InterfaceResult.SignedUrl;
    } else {
      throw new Error(`Failed to create temporary URL: ${result.CommonMsg.Message}`);
    }
  } catch (error) {
    console.error('Failed to create temporary URL:', error);
    throw error;
  }
}

/**
 * 上传文件到OBS
 * @param fileBuffer 文件Buffer
 * @param fileName 文件名
 * @param contentType 内容类型
 * @param useTemporaryUrl 是否返回临时访问URL
 * @returns 上传成功后的URL
 */
export async function uploadToObs(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  useTemporaryUrl: boolean = true
): Promise<string> {
  if (!accessKeyId || !secretAccessKey || !server || !bucketName) {
    throw new Error('OBS configuration missing');
  }

  const obsClient = getObsClient();
  
  // 生成保存路径
  const folderPrefix = contentType.startsWith('video') 
    ? 'videos'
    : contentType.startsWith('audio')
      ? 'audios'
      : 'files';
  const key = `${folderPrefix}/${fileName}`;
  
  try {
    const result = await obsClient.putObject({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType
    });
    
    if (result.CommonMsg.Status < 300) {
      if (useTemporaryUrl) {
        // 返回临时访问URL
        return await createTemporaryUrl(key);
      } else {
        // 返回永久URL
        return `https://${bucketName}.${server.replace('https://', '')}/${key}`;
      }
    } else {
      throw new Error(`Upload failed: ${result.CommonMsg.Message}`);
    }
  } catch (error) {
    console.error('Failed to upload to OBS:', error);
    throw error;
  }
}

/**
 * 从OBS获取文件
 * @param fileUrl 文件URL
 * @returns 文件Buffer
 */
export async function getFileFromObs(fileUrl: string): Promise<Buffer> {
  if (!accessKeyId || !secretAccessKey || !server || !bucketName) {
    throw new Error('OBS configuration missing');
  }
  
  const obsClient = getObsClient();
  
  // 从URL提取key
  const urlObj = new URL(fileUrl);
  const key = urlObj.pathname.slice(1); // 移除开头的斜杠
  
  try {
    const result = await obsClient.getObject({
      Bucket: bucketName,
      Key: key
    });
    
    if (result.CommonMsg.Status < 300 && result.InterfaceResult.Content) {
      return result.InterfaceResult.Content;
    } else {
      throw new Error(`Download failed: ${result.CommonMsg.Message}`);
    }
  } catch (error) {
    console.error('Failed to download from OBS:', error);
    throw error;
  }
}

/**
 * 从URL中提取OBS文件名
 * @param url 文件URL
 * @returns 文件名
 */
export function getFileNameFromUrl(url: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

export default {
  getObsClient,
  uploadToObs,
  getFileFromObs,
  getFileNameFromUrl,
  createTemporaryUrl
}; 