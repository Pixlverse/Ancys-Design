import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /**
   * The phone tab bar holds five, and is full. Items marked false live in the
   * sidebar only, and are reached on phones from the Settings hub.
   */
  inTabBar?: boolean
}

/** One definition, used by the desktop sidebar and the mobile tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Purchases", href: "/purchases", icon: ShoppingBag, inTabBar: false },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function isActiveNav(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
