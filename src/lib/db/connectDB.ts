import mongoose from 'mongoose';

// 定义MongooseCache接口
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// 全局变量中的mongoose缓存
const globalWithMongoose = global as typeof globalThis & {
  mongoose: MongooseCache;
};

// 初始化缓存
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

// 获取环境变量
const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * 连接到MongoDB数据库
 * 使用缓存避免在开发模式下重复连接
 */
async function connectDB() {
  // 如果已经有连接，直接返回
  if (globalWithMongoose.mongoose.conn) {
    return globalWithMongoose.mongoose.conn;
  }

  // 如果正在连接，等待连接完成
  if (!globalWithMongoose.mongoose.promise) {
    const opts = {
      bufferCommands: false,
    };

    globalWithMongoose.mongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  // 等待连接完成并返回连接
  globalWithMongoose.mongoose.conn = await globalWithMongoose.mongoose.promise;
  return globalWithMongoose.mongoose.conn;
}

export default connectDB; 