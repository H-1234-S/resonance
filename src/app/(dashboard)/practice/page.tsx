import ClientCounter from "./client-counter";

export default async function PracticePage() {
  // 服务端：模拟数据获取（实际项目中可能访问数据库）
  const mockData = {
    totalUsers: 1234,
    totalGenerations: 5678,
    totalCharacters: 987654,
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">实践练习：组件交互</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总用户数</h2>
          <p className="text-2xl">{mockData.totalUsers}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总生成次数</h2>
          <p className="text-2xl">{mockData.totalGenerations}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总字符数</h2>
          <p className="text-2xl">{mockData.totalCharacters}</p>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">客户端计数器</h2>
        <p className="text-muted-foreground mb-4">
          这是一个客户端组件，包含交互状态。
        </p>

        {/* 客户端组件 */}
        <ClientCounter initialValue={10} />
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">学习要点：</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>服务端组件可以直接访问数据库和API</li>
          <li>客户端组件可以处理用户交互和状态</li>
          <li>数据从服务端流向客户端</li>
          <li>交互在客户端处理，结果可以传回服务端</li>
        </ul>
      </div>
    </div>
  );
}