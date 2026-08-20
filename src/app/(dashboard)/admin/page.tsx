'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, Heart, Baby, Calendar, Syringe, UserPlus,
  TrendingUp, ArrowRight, Shield, Activity, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import DashboardHero from '@/components/layout/DashboardHero';
import { formatDate } from '@/lib/utils';

interface RecentRegistration {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string | Date;
}

interface DashboardData {
  totalMothers: number;
  totalMidwives: number;
  activePregnancies: number;
  totalChildren: number;
  visitsThisMonth: number;
  vaccinationsThisMonth: number;
  recentRegistrations: RecentRegistration[];
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        setDashboardData(data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#E5E7EB] border-t-[#2563EB]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="h-5 w-5 text-[#2563EB] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="relative min-h-screen">
      {/* Maternal Care Wallpaper Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/admin-wallpaper.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          opacity: 0.12,
        }}
      />
      {/* Soft gradient overlay for better contrast */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-br from-blue-50/40 via-white/60 to-pink-50/40" />

    <div className="space-y-6 relative z-10 min-h-screen">

      <DashboardHero
        title={`${greeting}, ${session?.user?.name} 👋`}
        pillLabel="System Administration"
        pillColorClass="text-[#10B981]"
        subtitle={(
          <>
            Monitor and manage the <span className="font-semibold text-white">CareNest</span> maternal health system. Everything is running smoothly.
          </>
        )}
        rightInfo={(
          <>
            <div className="text-right">
              <p className="text-xs text-[#6B7280] mb-0.5">Today</p>
              <p className="text-base font-semibold text-white">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D1FAE5]/10 border border-[#10B981]/20 rounded-full">
                <Activity className="h-3.5 w-3.5 text-[#10B981] animate-pulse" />
                <span className="text-xs text-[#10B981] font-medium">All Systems Active</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-full">
                <Shield className="h-3.5 w-3.5 text-[#2563EB]" />
                <span className="text-xs text-[#3B82F6] font-medium">Admin</span>
              </div>
            </div>
          </>
        )}
      />

      {/* ── Stats Grid ── */}
      {/* Each card uses one homepage feature accent colour */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Mothers → blue (homepage primary) */}
        <StatCard
          title="Total Mothers"
          value={dashboardData?.totalMothers?.toString() || '0'}
          icon={<Users className="h-5 w-5 text-[#2563EB]" />}
          iconBg="bg-blue-50"
          valueColor="text-[#2563EB]"
          barColor="bg-[#2563EB]"
          delay="stagger-1"
        />
        {/* Midwives → amber (homepage Shield accent) */}
        <StatCard
          title="Midwives"
          value={dashboardData?.totalMidwives?.toString() || '0'}
          icon={<UserPlus className="h-5 w-5 text-[#F59E0B]" />}
          iconBg="bg-amber-50"
          valueColor="text-[#F59E0B]"
          barColor="bg-[#F59E0B]"
          delay="stagger-2"
        />
        {/* Active Pregnancies → red/heart (homepage Heart accent) */}
        <StatCard
          title="Active Pregnancies"
          value={dashboardData?.activePregnancies?.toString() || '0'}
          icon={<Heart className="h-5 w-5 text-[#EF4444]" />}
          iconBg="bg-red-50"
          valueColor="text-[#EF4444]"
          barColor="bg-[#EF4444]"
          delay="stagger-3"
        />
        {/* Children → pink (homepage gradient end) */}
        <StatCard
          title="Children"
          value={dashboardData?.totalChildren?.toString() || '0'}
          icon={<Baby className="h-5 w-5 text-[#F472B6]" />}
          iconBg="bg-pink-50"
          valueColor="text-[#F472B6]"
          barColor="bg-[#F472B6]"
          delay="stagger-4"
        />
        {/* Visits → green (homepage emerald accent) */}
        <StatCard
          title="Visits (Month)"
          value={dashboardData?.visitsThisMonth?.toString() || '0'}
          icon={<Calendar className="h-5 w-5 text-[#10B981]" />}
          iconBg="bg-emerald-50"
          valueColor="text-[#10B981]"
          barColor="bg-[#10B981]"
          delay="stagger-5"
        />
        {/* Vaccinations → blue-500 (homepage Brain accent) */}
        <StatCard
          title="Vaccinations"
          value={dashboardData?.vaccinationsThisMonth?.toString() || '0'}
          icon={<Syringe className="h-5 w-5 text-[#3B82F6]" />}
          iconBg="bg-blue-50"
          valueColor="text-[#3B82F6]"
          barColor="bg-[#3B82F6]"
          delay="stagger-6"
        />
      </div>

      {/* ── Bottom Two-Column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Registrations */}
        <div className="animate-fade-in-up bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <span className="flex items-center gap-2.5 text-[#111827] font-semibold text-sm">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50">
                <TrendingUp className="h-4 w-4 text-[#2563EB]" />
              </div>
              Recent Registrations
            </span>
            <Link
              href="/mothers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-[#2563EB] hover:text-white px-3 py-1.5 rounded-full transition-all duration-300 group"
            >
              View All
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* List */}
          {dashboardData?.recentRegistrations && dashboardData.recentRegistrations.length > 0 ? (
            <div className="divide-y divide-[#F9FAFB]">
              {dashboardData.recentRegistrations.map((user: RecentRegistration, idx: number) => {
                // Cycle through homepage accent colours for avatars
                const avatarStyles = [
                  { bg: 'bg-blue-50', text: 'text-[#2563EB]', border: 'border-blue-100' },
                  { bg: 'bg-pink-50', text: 'text-[#F472B6]', border: 'border-pink-100' },
                  { bg: 'bg-emerald-50', text: 'text-[#10B981]', border: 'border-emerald-100' },
                  { bg: 'bg-amber-50', text: 'text-[#F59E0B]', border: 'border-amber-100' },
                  { bg: 'bg-red-50', text: 'text-[#EF4444]', border: 'border-red-100' },
                ];
                const style = avatarStyles[idx % avatarStyles.length];
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className={`h-10 w-10 rounded-xl border ${style.border} ${style.bg} flex items-center justify-center ${style.text} font-bold text-sm shrink-0`}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111827] truncate">{user.name}</p>
                      <p className="text-xs text-[#6B7280] truncate">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-block text-[10px] font-semibold text-[#10B981] bg-[#D1FAE5] px-2 py-0.5 rounded-full">
                        Mother
                      </span>
                      <p className="text-[10px] text-[#6B7280]">{user.createdAt ? formatDate(user.createdAt) : 'Recently'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-[#2563EB]" />
              </div>
              <p className="text-[#111827] text-sm font-semibold">No recent registrations</p>
              <p className="text-[#6B7280] text-xs mt-0.5 font-light">New mothers will appear here</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="animate-fade-in-up stagger-2 bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#E5E7EB]">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50">
              <BarChart3 className="h-4 w-4 text-[#F59E0B]" />
            </div>
            <span className="text-[#111827] font-semibold text-sm">Quick Actions</span>
          </div>

          <div className="p-5 grid grid-cols-2 gap-3">
            {/* Mothers – blue */}
            <ActionCard
              href="/mothers"
              icon={<Users className="h-5 w-5 text-[#2563EB]" />}
              iconBg="bg-blue-50"
              hoverBorder="hover:border-[#2563EB]/30"
              hoverShadow="hover:shadow-blue-100"
              label="Manage Mothers"
              sublabel={`${dashboardData?.totalMothers || 0} registered`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Midwives – amber */}
            <ActionCard
              href="/midwives"
              icon={<UserPlus className="h-5 w-5 text-[#F59E0B]" />}
              iconBg="bg-amber-50"
              hoverBorder="hover:border-[#F59E0B]/30"
              hoverShadow="hover:shadow-amber-100"
              label="Manage Midwives"
              sublabel={`${dashboardData?.totalMidwives || 0} active`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Visits – green */}
            <ActionCard
              href="/visits"
              icon={<Calendar className="h-5 w-5 text-[#10B981]" />}
              iconBg="bg-emerald-50"
              hoverBorder="hover:border-[#10B981]/30"
              hoverShadow="hover:shadow-emerald-100"
              label="All Visits"
              sublabel={`${dashboardData?.visitsThisMonth || 0} this month`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Vaccinations – blue-500 */}
            <ActionCard
              href="/vaccinations"
              icon={<Syringe className="h-5 w-5 text-[#3B82F6]" />}
              iconBg="bg-blue-50"
              hoverBorder="hover:border-[#3B82F6]/30"
              hoverShadow="hover:shadow-blue-100"
              label="Vaccinations"
              sublabel={`${dashboardData?.vaccinationsThisMonth || 0} this month`}
              sublabelColor="text-[#6B7280]"
            />

            {/* Reports – full-width dark CTA, mirrors homepage CTA section */}
            <Link
              href="/reports"
              className="action-glow col-span-2 flex items-center gap-4 p-4 bg-[#111827] rounded-2xl border border-[#1E40AF]/20 hover:border-[#2563EB]/40 hover:shadow-lg hover:shadow-black/10 transition-all duration-500 group"
            >
              {/* Blue → pink gradient icon, mirrors homepage h1 gradient */}
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#F472B6] shadow-lg group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-bold text-white block">Reports &amp; Analytics</span>
                <span className="text-xs text-[#6B7280] font-light">View system-wide insights</span>
              </div>
              <ArrowRight className="h-4 w-4 text-[#3B82F6] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

/* ── StatCard ── */
function StatCard({
  title, value, icon, iconBg, valueColor, barColor, delay,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
  barColor: string;
  delay: string;
}) {
  return (
    <div
      className={`card-lift animate-fade-in-up ${delay} bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm`}
    >
      {/* Thin top accent bar matching the icon colour */}
      <div className={`h-1 w-full ${barColor} opacity-70`} />
      <div className="p-4 pt-3.5">
        <div className="flex items-center justify-between mb-3">
          {/* Icon in homepage-style rounded-xl accent bg */}
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {/* Minimal live dot */}
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${barColor} animate-pulse`} />
            <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-widest">Live</span>
          </div>
        </div>
        <p className="text-[10px] text-[#6B7280] font-semibold uppercase tracking-widest mb-1">{title}</p>
        <p className={`text-3xl font-extrabold ${valueColor} animate-count-up`}>{value}</p>
      </div>
    </div>
  );
}

/* ── ActionCard ── */
function ActionCard({
  href, icon, iconBg, hoverBorder, hoverShadow, label, sublabel, sublabelColor,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  hoverBorder: string;
  hoverShadow: string;
  label: string;
  sublabel: string;
  sublabelColor: string;
}) {
  return (
    <Link
      href={href}
      className={`action-glow flex flex-col items-center p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl ${hoverBorder} hover:bg-white hover:shadow-md ${hoverShadow} transition-all duration-300 group`}
    >
      <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${iconBg} mb-3 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <span className="text-sm font-semibold text-[#111827]">{label}</span>
      <span className={`text-xs ${sublabelColor} mt-0.5 font-light`}>{sublabel}</span>
    </Link>
  );
}
