"use client";

import { cn } from "@granola/ui";

import { ProfileView } from "@/components/public-profile/profile-view";
import type { PublicProfile } from "@/components/public-profile/types";

type Props = {
  profile: PublicProfile;
  className?: string;
};

/** Marco de teléfono con la página pública adentro, tal como la ve una paciente. */
export function PhonePreview({ profile, className }: Props) {
  return (
    <div
      className={cn(
        "relative mx-auto w-[320px] max-w-full rounded-[2.75rem] border-[10px] border-[#1b1711] bg-[#1b1711] shadow-float",
        className,
      )}
    >
      {/* Notch */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-[#1b1711]"
      />
      <div className="h-[640px] overflow-y-auto overscroll-contain rounded-[2.1rem] bg-(--pp-bg) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ProfileView profile={profile} preview />
      </div>
    </div>
  );
}
