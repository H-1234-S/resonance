import { 
  fetchRequestHandler
} from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';
const handler = (req: Request) =>
  // fetchRequestHandler 是一个函数，用于处理传入的 HTTP 请求，并将其路由到 TRPC 服务器的相应处理程序。它接受一个配置对象，其中包含以下属性：
  // - endpoint: 指定 TRPC 服务器的端点 URL，通常是 '/api/trpc'。
  // - req: 传入的 HTTP 请求对象。
  // - router: TRPC 服务器的路由器实例，定义了所有可用的 API 路径和处理程序。
  // - createContext: 一个函数，用于创建 TRPC 上下文对象，通常包含请求相关的信息，如认证数据等。
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
export { handler as GET, handler as POST };