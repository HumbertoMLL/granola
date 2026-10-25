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
        "relative mx-auto w-[320px] max-w-full overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="h-[640px] overflow-y-auto overscroll-contain bg-(--pp-bg) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ProfileView profile={profile} preview />
      </div>
    </div>
  );
}
