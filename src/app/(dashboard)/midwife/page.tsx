'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui';
import { Users, Heart, Calendar, Syringe, AlertTriangle, CheckCircle, Clock, ArrowRight, Stethoscope, MessageSquare, Activity, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import DashboardHero from '@/components/layout/DashboardHero';

interface Visit {
  id: string;
  visitDate: string;
  visitType?: string;
  mother?: { user?: { name?: string } } | null;
}

interface PregnancyOverviewItem {
  id: string;
  motherName?: string;
  highRisk?: boolean;
  currentWeek?: number;
  progress?: {
    weeks: number;
    days: number;
    month: number;
    percentComplete: number;
    expectedDeliveryDate: string;
    daysRemaining: number;
    isOverdue: boolean;
    trimester: number;
    trimesterLabel: string;
  };
}

interface DashboardData {
  assignedMothers: number;
  activePregnancies: number;
  todayVisits: number;
  upcomingVisits: Visit[];
  pendingVaccinations: number;
  completedVisitsThisMonth: number;
  highRiskCases: number;
  pregnancyOverview: PregnancyOverviewItem[];
}

export default function MidwifeDashboard() {
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
            <Stethoscope className="h-5 w-5 text-[#2563EB] animate-pulse" />
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
        title={`${greeting}, ${session?.user?.name} 👩‍⚕️`}
        pillLabel="Midwife Portal"
        pillColorClass="text-[#10B981]"
        subtitle={(
          <>
            You have <span className="font-semibold text-white">{dashboardData?.todayVisits || 0} visits</span> scheduled for today on the CareNest system.
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
                <span className="text-xs text-[#10B981] font-medium">System Online</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-full">
                <Stethoscope className="h-3.5 w-3.5 text-[#2563EB]" />
                <span className="text-xs text-[#3B82F6] font-medium">Midwife</span>
              </div>
            </div>
          </>
        )}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assigned Mothers → blue */}
        <StatCard
          title="Assigned Mothers"
          value={dashboardData?.assignedMothers?.toString() || '0'}
          icon={<Users className="h-5 w-5 text-[#2563EB]" />}
          iconBg="bg-blue-50"
          valueColor="text-[#2563EB]"
          barColor="bg-[#2563EB]"
          delay="stagger-1"
        />
        {/* Active Pregnancies → pink */}
        <StatCard
          title="Active Pregnancies"
          value={dashboardData?.activePregnancies?.toString() || '0'}
          icon={<Heart className="h-5 w-5 text-[#F472B6]" />}
          iconBg="bg-pink-50"
          valueColor="text-[#F472B6]"
          barColor="bg-[#F472B6]"
          delay="stagger-2"
        />
        {/* High Risk Cases → red */}
        <StatCard
          title="High Risk Cases"
          value={dashboardData?.highRiskCases?.toString() || '0'}
          icon={<AlertTriangle className="h-5 w-5 text-[#EF4444]" />}
          iconBg="bg-red-50"
          valueColor="text-[#EF4444]"
          barColor="bg-[#EF4444]"
          delay="stagger-3"
        />
        {/* Completed This Month → green/emerald */}
        <StatCard
          title="Completed (Month)"
          value={dashboardData?.completedVisitsThisMonth?.toString() || '0'}
          icon={<CheckCircle className="h-5 w-5 text-[#10B981]" />}
          iconBg="bg-emerald-50"
          valueColor="text-[#10B981]"
          barColor="bg-[#10B981]"
          delay="stagger-4"
        />
      </div>

      {/* Today's Visits and Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upcoming Visits */}
        <div className="animate-fade-in-up bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <span className="flex items-center gap-2.5 text-[#111827] font-semibold text-sm">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50">
                <Calendar className="h-4 w-4 text-[#2563EB]" />
              </div>
              Upcoming Visits
            </span>
            <Link
              href="/visits"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-[#2563EB] hover:text-white px-3 py-1.5 rounded-full transition-all duration-300 group"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Content */}
          {dashboardData?.upcomingVisits && dashboardData.upcomingVisits.length > 0 ? (
            <div className="divide-y divide-[#F9FAFB]">
              {dashboardData.upcomingVisits.map((visit: Visit, idx: number) => {
                // Cycle avatar styles like admin list
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
                    key={visit.id}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl border ${style.border} ${style.bg} flex items-center justify-center ${style.text} font-bold text-sm shrink-0`}>
                        {visit.mother?.user?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">
                          {visit.mother?.user?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-[#6B7280] flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3 text-[#6B7280]" />
                          {formatDateTime(visit.visitDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={visit.visitType === 'ANTENATAL' ? 'info' : 'success'} className="font-semibold rounded-full px-2.5 py-0.5 text-[10px]">
                      {visit.visitType}
                    </Badge>
                  </div>
                );
              })}
            </div>

          ) : (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-[#2563EB]" />
              </div>
              <p className="text-[#111827] text-sm font-semibold">No upcoming visits</p>
              <p className="text-[#6B7280] text-xs mt-0.5 font-light">Visits will appear here</p>
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
            {/* View Mothers */}
            <ActionCard
              href="/mothers"
              icon={<Users className="h-5 w-5 text-[#2563EB]" />}
              iconBg="bg-blue-50"
              hoverBorder="hover:border-[#2563EB]/30"
              hoverShadow="hover:shadow-blue-100"
              label="View Mothers"
              sublabel={`${dashboardData?.assignedMothers || 0} assigned`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Schedule Visit */}
            <ActionCard
              href="/visits"
              icon={<Calendar className="h-5 w-5 text-[#10B981]" />}
              iconBg="bg-emerald-50"
              hoverBorder="hover:border-[#10B981]/30"
              hoverShadow="hover:shadow-emerald-100"
              label="Schedule Visit"
              sublabel={`${dashboardData?.todayVisits || 0} today`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Vaccinations */}
            <ActionCard
              href="/vaccinations"
              icon={<Syringe className="h-5 w-5 text-[#F59E0B]" />}
              iconBg="bg-amber-50"
              hoverBorder="hover:border-[#F59E0B]/30"
              hoverShadow="hover:shadow-amber-100"
              label="Vaccinations"
              sublabel={`${dashboardData?.pendingVaccinations || 0} pending`}
              sublabelColor="text-[#6B7280]"
            />
            {/* Messages */}
            <ActionCard
              href="/chat"
              icon={<MessageSquare className="h-5 w-5 text-[#3B82F6]" />}
              iconBg="bg-blue-50"
              hoverBorder="hover:border-[#3B82F6]/30"
              hoverShadow="hover:shadow-blue-100"
              label="Messages"
              sublabel="Direct Chat"
              sublabelColor="text-[#6B7280]"
            />
          </div>
        </div>
      </div>

      {/* Pending Vaccinations Alert */}
      {(dashboardData?.pendingVaccinations || 0) > 0 && (
        <div className="animate-fade-in-up relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-transparent border border-amber-200/60 p-5 shadow-sm">
          {/* Subtle decoration pattern */}
          <div className="absolute top-0 right-0 w-24 h-full bg-amber-100/20 blur-xl rounded-full translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-[#F59E0B] rounded-xl shrink-0">
                <Syringe className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-amber-900 text-lg">
                  {dashboardData?.pendingVaccinations} Pending Vaccinations
                </p>
                <p className="text-sm text-amber-700/90 font-light mt-0.5">
                  Immunization schedules due in the next 30 days. Action required.
                </p>
              </div>
            </div>
            <Link
              href="/vaccinations?status=pending"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-full font-semibold text-sm transition-all shadow-md shadow-amber-500/10 hover:shadow-lg hover:-translate-y-0.5"
            >
              View All Due
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Pregnancy Progress Overview */}
      {dashboardData?.pregnancyOverview && dashboardData.pregnancyOverview.length > 0 && (
        <div className="animate-fade-in-up bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <span className="flex items-center gap-2.5 text-[#111827] font-semibold text-sm">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-pink-50">
                <Heart className="h-4 w-4 text-[#F472B6]" />
              </div>
              Pregnancy Progress Overview
            </span>
            <Link
              href="/pregnancies"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-[#2563EB] hover:text-white px-3 py-1.5 rounded-full transition-all duration-300 group"
            >
              View All
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="p-6 space-y-4">
            {dashboardData.pregnancyOverview.map((item: PregnancyOverviewItem, idx: number) => {
              // Cycle avatar styles
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
                  key={item.id}
                  className={cn(
                    "p-5 rounded-2xl border transition-all duration-300",
                    item.highRisk 
                      ? 'border-red-200 bg-red-50/10 shadow-sm relative border-l-4 border-l-red-500' 
                      : 'border-[#E5E7EB] bg-white hover:shadow-sm'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl border ${style.border} ${style.bg} flex items-center justify-center ${style.text} font-bold text-sm shrink-0`}>
                        {item.motherName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{item.motherName}</span>
                        {item.highRisk && (
                          <Badge variant="danger" className="font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-full shadow-sm">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            High Risk
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.progress && (
                      <Badge variant={
                        item.progress.isOverdue ? 'danger' :
                        item.progress.trimester === 3 ? 'warning' : 'info'
                      } className="font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full shadow-sm shrink-0">
                        {item.progress.trimesterLabel}
                      </Badge>
                    )}
                  </div>

                  {item.progress ? (
                    <>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-gray-500 font-semibold uppercase tracking-wider">
                          Week {item.progress.weeks}, Day {item.progress.days} · Month {item.progress.month}
                        </span>
                        <span className="text-gray-900 font-extrabold">{item.progress.percentComplete}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden shadow-inner">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500 relative",
                            item.progress.isOverdue
                              ? 'bg-gradient-to-r from-red-500 to-rose-600'
                              : 'bg-gradient-to-r from-[#2563EB] to-[#F472B6]'
                          )}
                          style={{ width: `${item.progress.percentComplete}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-2.5 py-1 rounded-xl">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          EDD: <strong className="text-gray-700 font-bold">{formatDate(item.progress.expectedDeliveryDate)}</strong>
                        </span>
                        <span className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-semibold uppercase tracking-wider text-[10px]",
                          item.progress.isOverdue 
                            ? 'bg-red-50 text-red-700 border border-red-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        )}>
                          <Clock className="h-3.5 w-3.5" />
                          {item.progress.isOverdue
                            ? 'Overdue'
                            : `${item.progress.daysRemaining} days remaining`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 font-light mt-1">
                      Week {item.currentWeek || '?'} · LMP not recorded
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
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