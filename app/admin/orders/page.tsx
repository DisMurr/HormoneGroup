import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Recent Orders</h1>
      <p className="text-sm text-gray-600 mt-1">Last 50 (test mode)</p>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2 pr-4">Items</th>
              <th className="py-2 pr-4">Session</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="py-2 pr-4">{o.createdAt.toISOString().slice(0,19).replace('T',' ')}</td>
                <td className="py-2 pr-4">{o.email}</td>
                <td className="py-2 pr-4">{o.mode}</td>
                <td className="py-2 pr-4">
                  {Array.isArray(o.items)
                    ? o.items.map((i: any, idx: number) =>
                        <div key={idx}>{i.quantity ?? 1} × {i.description ?? i.priceId}</div>
                      )
                    : '—'}
                </td>
                <td className="py-2 pr-4 text-gray-500">{o.stripeSessionId}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-gray-500">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
