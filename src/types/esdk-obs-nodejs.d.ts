declare module 'esdk-obs-nodejs' {
  interface ObsConfig {
    access_key_id: string;
    secret_access_key: string;
    server: string;
  }

  interface ObsResponse {
    CommonMsg: {
      Status: number;
      Message: string;
    };
    InterfaceResult: {
      Content?: Buffer;
      SignedUrl?: string;
      [key: string]: unknown;
    };
  }

  interface PutObjectParams {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
  }

  interface GetObjectParams {
    Bucket: string;
    Key: string;
  }

  interface CreateTempUrlParams {
    Method: string; // HTTP方法: 'GET', 'PUT'等
    Bucket: string;
    Key: string;
    Expires?: number; // 过期时间，单位：秒
    QueryParams?: Record<string, string>;
    Headers?: Record<string, string>;
  }

  class ObsClient {
    constructor(config: ObsConfig);
    putObject(params: PutObjectParams): Promise<ObsResponse>;
    getObject(params: GetObjectParams): Promise<ObsResponse>;
    createTemporarySignedUrl(params: CreateTempUrlParams): Promise<ObsResponse>;
    createSignedUrlSync(params: CreateTempUrlParams): { SignedUrl: string };
  }

  export default ObsClient;
} 