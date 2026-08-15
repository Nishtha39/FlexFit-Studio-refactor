'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Bell, Menu, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/v2/ui/button'
import { Input } from '@/components/v2/ui/input'
import { Sidebar } from '@/components/v2/dashboard/sidebar'
import { TEAM } from '@/lib/v2/data/dashboard'

/**
 * Dashboard header: mobile nav trigger, search, team presence and actions.
 */
export function Topbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="relative max-w-xs flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search members, classes…"
            aria-label="Search"
            className="h-9 bg-card pl-9 text-sm"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Team presence, folded away on narrow screens. */}
          <ul className="hidden items-center md:flex">
            {TEAM.map((member, index) => (
              <li
                key={member.id}
                className="-ml-2 first:ml-0"
                style={{ zIndex: TEAM.length - index }}
              >
                <Image
                  src={member.avatar}
                  alt={member.name}
                  title={`${member.name} · ${member.role}`}
                  width={30}
                  height={30}
                  className="size-[30px] rounded-full border-2 border-background object-cover"
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Notifications, 3 unread"
          >
            <Bell className="size-[18px]" aria-hidden="true" />
            <span
              className="absolute top-2 right-2 size-1.5 rounded-full bg-brand"
              aria-hidden="true"
            />
          </button>

          <Button className="h-9 rounded-full bg-brand px-4 text-sm text-white hover:bg-brand/90">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add member</span>
          </Button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/40"
            aria-label="Close navigation"
          />
          <div className="relative h-full w-72 max-w-[80vw]">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 -right-11 flex size-9 items-center justify-center rounded-lg bg-card text-foreground shadow-sm"
              aria-label="Close navigation"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
