'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Home,
  Users,
  Baby,
  Calendar,
  Syringe,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  FileText,
  Brain,
  UserPlus,
  Package,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface NavLeaf {
  kind: 'leaf';
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavGroup {
  kind: 'group';
  label: string;
  icon: React.ElementType;
  roles: string[];
  /** Paths that belong to this group — used to auto-expand when active */
  matchPaths: string[];
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavGroup;

// ── Nav definition ─────────────────────────────────────────────────────────────

const navItems: NavItem[] = [
  // ── Dashboards
  { kind: 'leaf', label: 'Dashboard', href: '/mother',  icon: Home, roles: ['MOTHER']  },
  { kind: 'leaf', label: 'Dashboard', href: '/midwife', icon: Home, roles: ['MIDWIFE'] },
  { kind: 'leaf', label: 'Dashboard', href: '/admin',   icon: Home, roles: ['ADMIN']   },

  // ── Admin — Midwives
  { kind: 'leaf', label: 'Midwives', href: '/midwives', icon: UserPlus, roles: ['ADMIN'] },

  // ── Midwife / Admin — Mother Management group
  {
    kind: 'group',
    label: 'Mother Management',
    icon: Users,
    roles: ['MIDWIFE', 'ADMIN'],
    matchPaths: ['/mothers', '/mother-growth'],
    children: [
      { kind: 'leaf', label: 'Mothers',        href: '/mothers',       icon: Users,      roles: ['MIDWIFE', 'ADMIN'] },
      { kind: 'leaf', label: 'Growth Tracker', href: '/mother-growth', icon: TrendingUp, roles: ['MIDWIFE', 'ADMIN'] },
    ],
  },

  // ── Mother — Pregnancy & Health group (includes her own growth history)
  {
    kind: 'group',
    label: 'Pregnancy & Health',
    icon: Heart,
    roles: ['MOTHER'],
    matchPaths: ['/pregnancies', '/mother-growth'],
    children: [
      { kind: 'leaf', label: 'My Pregnancy', href: '/pregnancies',            icon: Heart,      roles: ['MOTHER'] },
      { kind: 'leaf', label: 'My Growth',    href: '/mother-growth/my-history', icon: TrendingUp, roles: ['MOTHER'] },
    ],
  },

  // ── Shared / other top-level items
  { kind: 'leaf', label: 'Pregnancies',       href: '/pregnancies',   icon: Heart,         roles: ['MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'My Children',       href: '/children',      icon: Baby,          roles: ['MOTHER']           },
  { kind: 'leaf', label: 'Children',          href: '/children',      icon: Baby,          roles: ['MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'My Visits',         href: '/visits',        icon: Calendar,      roles: ['MOTHER']           },
  { kind: 'leaf', label: 'Visits',            href: '/visits',        icon: Calendar,      roles: ['MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'My Vaccinations',   href: '/vaccinations',  icon: Syringe,       roles: ['MOTHER']           },
  { kind: 'leaf', label: 'Vaccinations',      href: '/vaccinations',  icon: Syringe,       roles: ['MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'My Reports',        href: '/my-reports',    icon: FileText,      roles: ['MOTHER']           },
  { kind: 'leaf', label: 'AI Care',           href: '/ai-care',       icon: Brain,         roles: ['MOTHER']           },
  { kind: 'leaf', label: 'Chat',              href: '/chat',          icon: MessageSquare, roles: ['MOTHER', 'MIDWIFE'] },
  { kind: 'leaf', label: 'Notifications',     href: '/notifications', icon: Bell,          roles: ['MOTHER', 'MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'Thriposha',         href: '/thriposha',     icon: Package,       roles: ['MIDWIFE']          },
  { kind: 'leaf', label: 'Reports',           href: '/reports',       icon: FileText,      roles: ['MIDWIFE', 'ADMIN'] },
  { kind: 'leaf', label: 'Thriposha Reports', href: '/thriposha-reports', icon: Package,   roles: ['ADMIN']            },
  { kind: 'leaf', label: 'Settings',          href: '/settings',      icon: Settings,      roles: ['MOTHER', 'MIDWIFE', 'ADMIN'] },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.matchPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeafLink({
  item,
  pathname,
  indent = false,
  onClick,
}: {
  item: NavLeaf;
  pathname: string;
  indent?: boolean;
  onClick?: () => void;
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
          indent ? 'px-3 py-2 ml-4' : 'px-3 py-2',
          isActive
            ? 'bg-blue-50 text-blue-600 font-semibold'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    </li>
  );
}

function GroupNav({
  group,
  pathname,
  onClose,
}: {
  group: NavGroup;
  pathname: string;
  onClose: () => void;
}) {
  const active = isGroupActive(group, pathname);
  const [open, setOpen] = useState(active);

  // Auto-expand when the user navigates to a child page
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const GroupIcon = group.icon;

  return (
    <li>
      {/* Group header — toggles expand/collapse */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors',
          active
            ? 'bg-blue-50 text-blue-600 font-semibold'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <GroupIcon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
        )}
      </button>

      {/* Children */}
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {group.children.map((child) => (
            <LeafLink
              key={child.href}
              item={child}
              pathname={pathname}
              indent
              onClick={onClose}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname() || '';
  const { data: session } = useSession();
  const userRole = session?.user?.role || 'MOTHER';

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  const close = () => setIsOpen(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 z-40"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-200 group cursor-pointer">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#F472B6] opacity-0 group-hover:opacity-100 transition duration-500 blur-xs" />
              <Heart className="relative h-7 w-7 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 bg-clip-text">
              CareNest
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {visibleItems.map((item) => {
                if (item.kind === 'group') {
                  return (
                    <GroupNav
                      key={item.label + item.roles.join()}
                      group={item}
                      pathname={pathname}
                      onClose={close}
                    />
                  );
                }
                return (
                  <LeafLink
                    key={item.href + item.label}
                    item={item}
                    pathname={pathname}
                    onClick={close}
                  />
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
