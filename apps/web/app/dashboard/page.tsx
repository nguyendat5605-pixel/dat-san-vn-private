// apps/web/app/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
        redirect('/sign-in');
    }

    return (
        <div className="min-h-screen bg-zinc-950 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Dashboard</h1>
                    <UserButton />
                </div>

                <div className="bg-zinc-900 rounded-xl p-8 text-white">
                    <p className="text-xl">
                        Chào {user.firstName || user.emailAddresses[0]?.emailAddress} 👋
                    </p>
                    <p className="text-zinc-400 mt-2">
                        Bạn đã đăng nhập thành công vào DatSanVN.
                    </p>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-800 p-6 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                            <p className="text-2xl font-bold">Tìm sân gần đây</p>
                        </div>
                        <div className="bg-zinc-800 p-6 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                            <p className="text-2xl font-bold">Lịch đặt của tôi</p>
                        </div>
                        <div className="bg-zinc-800 p-6 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                            <p className="text-2xl font-bold">Profile</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}